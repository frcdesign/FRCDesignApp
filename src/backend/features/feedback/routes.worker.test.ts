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
    FeedbackSource,
    FeedbackTopic
} from "./contract";
import * as Discord from "./discord";
import { REPORT_LIMIT } from "./rate-limit";

const db = getDb(env.DB);

const WEBHOOKS = {
    DISCORD_APP_WEBHOOK_URL: "https://discord.test/app",
    DISCORD_FRC_DESIGN_LIB_WEBHOOK_URL: "https://discord.test/frc-design-lib",
    DISCORD_CONFIG_LIB_WEBHOOK_URL: "https://discord.test/config-lib"
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
        [FeedbackTopic.CONFIG_LIB, WEBHOOKS.DISCORD_CONFIG_LIB_WEBHOOK_URL]
    ])("posts a %s report to its channel", async (topic, webhook) => {
        const res = await send(
            body({ topic, category: FeedbackCategory.FEATURE_REQUEST })
        );

        expect(res.status).toBe(200);
        expect(postedTo()).toEqual([webhook]);
    });

    it("records the report, and counts it apart from library use", async () => {
        const userId = "reporter";
        const res = await send(
            body({
                topic: FeedbackTopic.MKCAD,
                category: FeedbackCategory.PART_REQUEST
            }),
            { userId }
        );
        const { reportId } = await res.json<{ reportId: string }>();

        expect(await db.select().from(events).get()).toMatchObject({
            id: reportId,
            type: EventType.REPORT,
            libraryId: LibraryId.MKCAD,
            userId,
            reportTopic: FeedbackTopic.MKCAD,
            reportCategory: FeedbackCategory.PART_REQUEST,
            reportSource: FeedbackSource.GENERAL,
            elementId: null
        });
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
        expect(embed.fields.find((field) => field.name === "Part")?.value).toBe(
            "Test Group / Test PARTSTUDIO"
        );
        expect(embed.url).toContain(`/e/${TEST_PART_STUDIO_PATH.elementId}`);
        expect(embed.url).toContain("configuration=boolean%3Dfalse");
        expect(
            embed.fields.find((field) => field.name === "Configuration")?.value
        ).toContain("Test boolean: No");

        expect(await db.select().from(dailyReportMetrics).get()).toMatchObject({
            elementId: TEST_PART_STUDIO_PATH.elementId,
            source: FeedbackSource.PART
        });
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
        expect(embed.fields.map((field) => field.name)).not.toContain(
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
        ["no message", body({ message: "  " })],
        ["no title", body({ title: "  " })],
        ["a title too long for a thread", body({ title: "x".repeat(101) })],
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
            message.embeds[0].fields.find((field) => field.name === "Error")
        ).toBeDefined();
    });

    it("files the thread under the forum's tags for its topic, type and source", async () => {
        const res = await send(
            body({
                topic: FeedbackTopic.MKCAD,
                category: FeedbackCategory.BUG,
                source: FeedbackSource.ERROR
            }),
            {
                bindings: {
                    ...WEBHOOKS,
                    DISCORD_FRC_DESIGN_LIB_TAG_IDS: JSON.stringify({
                        mkcad: "tag-mkcad",
                        bug: "tag-bug",
                        "error-report": "tag-error",
                        "frc-design-lib": "tag-frc"
                    })
                }
            }
        );

        expect(res.status).toBe(200);
        expect(post.mock.calls[0][1].applied_tags).toEqual([
            "tag-mkcad",
            "tag-bug",
            "tag-error"
        ]);
    });

    it("sends a report untagged when its forum's tag ids are malformed", async () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);

        const res = await send(body(), {
            bindings: { ...WEBHOOKS, DISCORD_APP_TAG_IDS: "{not json" }
        });

        expect(res.status).toBe(200);
        expect(post.mock.calls[0][1]).not.toHaveProperty("applied_tags");
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
