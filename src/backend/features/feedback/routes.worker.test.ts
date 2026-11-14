import { env } from "cloudflare:workers";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    type MockInstance,
    vi
} from "vitest";
import {
    createTestApp,
    jsonRequest,
    resetDb,
    seedConfiguration,
    seedPartStudio,
    TEST_PART_STUDIO_ID,
    TEST_PART_STUDIO_PATH,
    TEST_USER_ID
} from "../../../__test_utils__";
import { getDb } from "../../db/client";
import { dailyMetrics, dailyReportMetrics, events } from "../analytics/schema";
import { EventType } from "../analytics/usage";
import { SIGNED_OUT_USER_ID } from "../analytics/tracking";
import { LibraryId } from "../library/library-id";
import {
    FeedbackCategory,
    type FeedbackIn,
    type FeedbackOut,
    FeedbackSource,
    FeedbackTopic
} from "./contract";
import * as Discord from "./discord";
import { REPORT_LIMIT } from "./rate-limit";
import {
    featureScripts,
    featureScriptsDocument
} from "../featurescripts/schema";

const db = getDb(env.DB);

const WEBHOOKS = {
    DISCORD_APP_WEBHOOK_URL: "https://discord.test/app",
    DISCORD_FRC_DESIGN_LIB_WEBHOOK_URL: "https://discord.test/frc-design-lib",
    DISCORD_CONFIG_LIB_WEBHOOK_URL: "https://discord.test/config-lib",
    DISCORD_FEATURESCRIPTS_WEBHOOK_URL: "https://discord.test/featurescripts"
};

const DIAGNOSTICS = { url: "https://app.test/app/library/frc-design-lib" };

function body(overrides: Partial<FeedbackIn> = {}): FeedbackIn {
    return {
        topic: FeedbackTopic.APP,
        category: FeedbackCategory.BUG,
        source: FeedbackSource.GENERAL,
        title: "Something broke",
        message: "Something broke.",
        diagnostics: DIAGNOSTICS,
        ...overrides
    };
}

let post: MockInstance<typeof Discord.postToDiscord>;

/** A fresh reporter per test, so the rate limit in KV doesn't carry between them. */
function send(
    payload: FeedbackIn,
    options: { signedIn?: boolean; userId?: string; bindings?: object } = {}
) {
    const app = createTestApp({
        signedIn: options.signedIn ?? true,
        userId: options.userId ?? crypto.randomUUID()
    });
    return app.request("/api/feedback", jsonRequest("POST", payload), {
        ...env,
        ...(options.bindings ?? WEBHOOKS)
    });
}

/** The webhook each post went to. */
function postedTo(): string[] {
    return post.mock.calls.map(([url]) => url);
}

describe("POST /api/feedback", () => {
    beforeEach(async () => {
        await resetDb(db);
        post = vi.spyOn(Discord, "postToDiscord").mockResolvedValue();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it.each([
        [FeedbackTopic.APP, WEBHOOKS.DISCORD_APP_WEBHOOK_URL],
        [FeedbackTopic.VERSION_MANAGER, WEBHOOKS.DISCORD_APP_WEBHOOK_URL],
        [
            FeedbackTopic.FRC_DESIGN_LIB,
            WEBHOOKS.DISCORD_FRC_DESIGN_LIB_WEBHOOK_URL
        ],
        [FeedbackTopic.MKCAD, WEBHOOKS.DISCORD_FRC_DESIGN_LIB_WEBHOOK_URL],
        [FeedbackTopic.CONFIG_LIB, WEBHOOKS.DISCORD_CONFIG_LIB_WEBHOOK_URL],
        [
            FeedbackTopic.FEATURESCRIPTS,
            WEBHOOKS.DISCORD_FEATURESCRIPTS_WEBHOOK_URL
        ]
    ])("posts a %s report to its channel", async (topic, webhook) => {
        // A bug is the one kind every topic takes.
        const res = await send(body({ topic, category: FeedbackCategory.BUG }));

        expect(res.status).toBe(200);
        expect(postedTo()).toEqual([webhook]);
    });

    it("records the report, and counts it apart from library use", async () => {
        const userId = "reporter";
        const res = await send(
            body({
                topic: FeedbackTopic.MKCAD,
                category: FeedbackCategory.PART_REQUEST,
                teamNumber: 254
            }),
            { userId }
        );
        const { reportId } = await res.json<FeedbackOut>();

        expect(await db.select().from(events).get()).toMatchObject({
            id: reportId,
            type: EventType.REPORT,
            libraryId: LibraryId.MKCAD,
            userId,
            reportTopic: FeedbackTopic.MKCAD,
            reportCategory: FeedbackCategory.PART_REQUEST,
            reportSource: FeedbackSource.GENERAL,
            reportTeamNumber: 254,
            elementId: null
        });
        expect(
            post.mock.calls[0][1].embeds[0].fields?.find(
                (field) => field.name === "Team number"
            )?.value
        ).toBe("254");
        expect(await db.select().from(dailyReportMetrics).all()).toEqual([
            expect.objectContaining({
                topic: FeedbackTopic.MKCAD,
                category: FeedbackCategory.PART_REQUEST,
                elementId: "",
                count: 1
            })
        ]);
        // A report is not an insert or an open.
        expect(await db.select().from(dailyMetrics).all()).toEqual([]);
    });

    it("names the part and its configuration in a part report", async () => {
        await seedPartStudio(db);
        await seedConfiguration(db);

        const res = await send(
            body({
                topic: FeedbackTopic.FRC_DESIGN_LIB,
                category: FeedbackCategory.BROKEN_CONFIGURATION,
                source: FeedbackSource.PART,
                part: {
                    insertableId: TEST_PART_STUDIO_ID,
                    selection: { boolean: "false" }
                }
            })
        );

        expect(res.status).toBe(200);
        const [, message] = post.mock.calls[0];
        const [embed] = message.embeds;
        expect(embed.title).toBe("Something broke");
        expect(
            embed.fields?.find((field) => field.name === "Part")?.value
        ).toBe("Test Group / Test PARTSTUDIO");
        expect(embed.url).toContain(`/e/${TEST_PART_STUDIO_PATH.elementId}`);
        expect(embed.url).toContain("configuration=boolean%3Dfalse");
        expect(
            embed.fields?.find((field) => field.name === "Configuration")?.value
        ).toContain("Test boolean: No");

        expect(await db.select().from(dailyReportMetrics).get()).toMatchObject({
            elementId: TEST_PART_STUDIO_PATH.elementId,
            source: FeedbackSource.PART
        });
    });

    it("logs the report under its id, and posts the failed request and the server's error id", async () => {
        const logged = vi
            .spyOn(console, "log")
            .mockImplementation(() => undefined);
        const userId = crypto.randomUUID();
        const error = {
            shown: "The app has crashed due to an unexpected error.",
            kind: "internal",
            detail: "Internal Server Error",
            request: "GET /api/library-data/library/mkcad → 500",
            errorId: "8f00ba11-IAD"
        };

        const res = await send(
            body({
                source: FeedbackSource.ERROR,
                message: "",
                diagnostics: { ...DIAGNOSTICS, error }
            }),
            { userId }
        );
        const { reportId } = await res.json<FeedbackOut>();

        expect(logged).toHaveBeenCalledWith(
            expect.objectContaining({
                event: "report",
                id: reportId,
                userId,
                title: "Something broke",
                diagnostics: { ...DIAGNOSTICS, error }
            })
        );
        const [embed] = post.mock.calls[0][1].embeds;
        const errorField = embed.fields?.find(
            (field) => field.name === "Error"
        )?.value;
        expect(errorField).toContain(`request: ${error.request}`);
        expect(errorField).toContain("error id: 8f00ba11-IAD");
    });

    it("names the part an error report from a failed insert is about, from any library", async () => {
        await seedPartStudio(db);
        await seedConfiguration(db);

        const res = await send(
            body({
                source: FeedbackSource.ERROR,
                message: "",
                part: {
                    insertableId: TEST_PART_STUDIO_ID,
                    selection: { boolean: "false" }
                },
                diagnostics: {
                    ...DIAGNOSTICS,
                    error: { shown: "Failed to insert Test PARTSTUDIO." }
                }
            })
        );

        expect(res.status).toBe(200);
        expect(postedTo()).toEqual([WEBHOOKS.DISCORD_APP_WEBHOOK_URL]);
        const [embed] = post.mock.calls[0][1].embeds;
        expect(embed.url).toContain("configuration=boolean%3Dfalse");
        expect(
            embed.fields?.find((field) => field.name === "Configuration")?.value
        ).toContain("Test boolean: No");
    });

    it("leaves the configuration out when the reporter does", async () => {
        await seedPartStudio(db);
        await seedConfiguration(db);

        await send(
            body({
                topic: FeedbackTopic.FRC_DESIGN_LIB,
                category: FeedbackCategory.METADATA,
                source: FeedbackSource.PART,
                part: { insertableId: TEST_PART_STUDIO_ID }
            })
        );

        const [embed] = post.mock.calls[0][1].embeds;
        expect(embed.url).not.toContain("configuration=");
        expect(embed.fields?.map((field) => field.name)).not.toContain(
            "Configuration"
        );
    });

    it("refuses a part from another library than the topic's", async () => {
        await seedPartStudio(db);

        const res = await send(
            body({
                topic: FeedbackTopic.CONFIG_LIB,
                category: FeedbackCategory.METADATA,
                source: FeedbackSource.PART,
                part: { insertableId: TEST_PART_STUDIO_ID }
            })
        );

        expect(res.status).toBe(404);
        expect(post).not.toHaveBeenCalled();
    });

    it.each([
        [
            "a category from another topic",
            body({ category: FeedbackCategory.PART_REQUEST })
        ],
        [
            "a feature request for a library",
            body({
                topic: FeedbackTopic.FRC_DESIGN_LIB,
                category: FeedbackCategory.FEATURE_REQUEST
            })
        ],
        ["no message", body({ message: "  " })],
        ["no title", body({ title: "  " })],
        ["a title too long for a thread", body({ title: "x".repeat(101) })],
        ["a team number that isn't one", body({ teamNumber: 25.4 })],
        [
            "a part outside a part report",
            body({ part: { insertableId: TEST_PART_STUDIO_ID } })
        ]
    ])("refuses %s", async (_label, payload) => {
        const res = await send(payload);

        expect(res.status).toBe(400);
        expect(post).not.toHaveBeenCalled();
    });

    it("takes an error report with nothing typed", async () => {
        const res = await send(
            body({
                source: FeedbackSource.ERROR,
                message: "",
                diagnostics: {
                    ...DIAGNOSTICS,
                    error: {
                        shown: "Failed to insert.",
                        detail: "x".repeat(5000)
                    }
                }
            })
        );

        expect(res.status).toBe(200);
        const [, message] = post.mock.calls[0];
        expect(
            message.embeds[0].fields?.find((field) => field.name === "Error")
        ).toBeDefined();
    });

    it("says the reporter was signed in, never who they are", async () => {
        const userId = "5eace32713a966103efd2a9d";

        await send(body(), { userId });

        const posted = post.mock.calls[0][1];
        expect(JSON.stringify(posted)).not.toContain(userId);
        expect(posted.embeds[1].description).toContain("Signed in: Yes");
    });

    it("takes a report from somebody who isn't signed in", async () => {
        const res = await send(body(), { signedIn: false });

        expect(res.status).toBe(200);
        expect(await db.select().from(events).get()).toMatchObject({
            userId: SIGNED_OUT_USER_ID
        });
    });

    it("says so when the environment has no channel for the topic", async () => {
        const res = await send(body(), { bindings: {} });

        expect(res.status).toBe(503);
        expect(await res.json()).toMatchObject({ kind: "handled" });
    });

    it("stops a reporter who sends too many", async () => {
        const userId = "busy-reporter";
        for (let sent = 0; sent < REPORT_LIMIT; sent++) {
            expect((await send(body(), { userId })).status).toBe(200);
        }

        const res = await send(body(), { userId });

        expect(res.status).toBe(429);
        expect(post).toHaveBeenCalledTimes(REPORT_LIMIT);
    });

    it("records nothing when Discord refuses the post", async () => {
        post.mockRejectedValue(new Error("Discord is down"));

        const res = await send(body(), { userId: TEST_USER_ID });

        expect(res.status).toBe(500);
        expect(await db.select().from(events).all()).toEqual([]);
    });
});

describe("POST /api/feedback about a FeatureScript", () => {
    beforeEach(async () => {
        await resetDb(db);
        post = vi.spyOn(Discord, "postToDiscord").mockResolvedValue();
        await db.insert(featureScriptsDocument).values({
            documentId: "frontend",
            versionId: "v-1",
            cacheVersion: 1
        });
        await db.insert(featureScripts).values({
            id: "frame",
            elementId: "e-frame",
            microversionId: "mv",
            featureType: "robotFrame",
            name: "Robot frame",
            description: "Add tube.",
            releaseVersion: "1.3.0",
            sourceUrl:
                "https://github.com/robot-education/robot-code/blob/robotFrame/v1.3.0/featurescripts/released/frame/robotFrame.fs"
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function featureReport(overrides: Partial<FeedbackIn> = {}) {
        return body({
            topic: FeedbackTopic.FEATURESCRIPTS,
            source: FeedbackSource.FEATURESCRIPT,
            featureScript: { featureScriptId: "frame" },
            ...overrides
        });
    }

    it("names the feature in its post, linking its studio, and counts it by its constant", async () => {
        const res = await send(featureReport());
        expect(res.status).toBe(200);

        expect(postedTo()).toEqual([
            WEBHOOKS.DISCORD_FEATURESCRIPTS_WEBHOOK_URL
        ]);
        const [main] = post.mock.calls[0][1].embeds;
        expect(main.url).toBe(
            "https://cad.onshape.com/documents/frontend/v/v-1/e/e-frame"
        );
        expect(main.fields).toContainEqual(
            expect.objectContaining({
                name: "FeatureScript",
                value: expect.stringContaining("Robot frame v1.3.0")
            })
        );
        expect(await db.select().from(events).get()).toMatchObject({
            type: EventType.REPORT,
            libraryId: null,
            reportTopic: FeedbackTopic.FEATURESCRIPTS,
            reportSource: FeedbackSource.FEATURESCRIPT,
            featureType: "robotFrame"
        });
    });

    it("takes a feature picked in the general form, under FeatureScripts", async () => {
        const res = await send(
            featureReport({ source: FeedbackSource.GENERAL })
        );
        expect(res.status).toBe(200);
    });

    it.each([
        [
            "names a feature under another topic",
            { topic: FeedbackTopic.APP, source: FeedbackSource.GENERAL }
        ],
        ["comes from a menu but names none", { featureScript: undefined }],
        [
            "is an error, which is the app's",
            { source: FeedbackSource.ERROR, featureScript: undefined }
        ]
    ])("refuses a report that %s", async (_, overrides) => {
        const res = await send(featureReport(overrides));
        expect(res.status).toBe(400);
        expect(post).not.toHaveBeenCalled();
    });

    it("refuses a feature that isn't loaded", async () => {
        const res = await send(
            featureReport({ featureScript: { featureScriptId: "gone" } })
        );
        expect(res.status).toBe(404);
        expect(post).not.toHaveBeenCalled();
    });
});
