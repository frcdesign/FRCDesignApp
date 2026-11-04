import { afterEach, describe, expect, it, vi } from "vitest";
import { FeedbackCategory, FeedbackSource, FeedbackTopic } from "./contract";
import { buildReportMessage, postToDiscord, type Report } from "./discord";

const WEBHOOK = "https://discord.com/api/webhooks/1/token";

function report(overrides: Partial<Report> = {}): Report {
    return {
        id: "report-1",
        title: "Bearing's part number",
        tagIds: [],
        topic: FeedbackTopic.FRC_DESIGN_LIB,
        category: FeedbackCategory.METADATA,
        source: FeedbackSource.PART,
        message: "The part number is wrong.",
        signedIn: true,
        userAgent: "Test browser",
        part: {
            name: "Bearing",
            groupName: "Bearings",
            url: "https://cad.onshape.com/documents/d/v/v/e/e",
            configuration: ["Size: 1/2 in"]
        },
        diagnostics: { url: "https://app.test/app/library/frc-design-lib" },
        createdAt: new Date("2026-10-31T12:00:00Z"),
        ...overrides
    };
}

function fieldValue(
    message: ReturnType<typeof buildReportMessage>,
    name: string
) {
    return message.embeds[0].fields?.find((field) => field.name === name)
        ?.value;
}

/** A line of the details block under the report. */
function detail(message: ReturnType<typeof buildReportMessage>, label: string) {
    return message.embeds[1].description
        .split("\n")
        .find((line) => line.startsWith(`${label}: `))
        ?.slice(label.length + 2);
}

describe("buildReportMessage", () => {
    it("titles the thread as the reporter did, and links to the part", () => {
        const message = buildReportMessage(report());
        const [embed] = message.embeds;

        expect(message.thread_name).toBe("Bearing's part number");
        expect(embed.title).toBe("Bearing's part number");
        expect(detail(message, "Type")).toBe("Missing or incorrect metadata");
        expect(embed.url).toBe("https://cad.onshape.com/documents/d/v/v/e/e");
        expect(embed.description).toBe("The part number is wrong.");
        expect(fieldValue(message, "Part")).toBe("Bearings / Bearing");
        expect(fieldValue(message, "Configuration")).toContain("Size: 1/2 in");
        expect(message.embeds[1].footer?.text).toBe("Report report-1");
    });

    it("puts what was reported first, and where it came from after", () => {
        const message = buildReportMessage(report());
        expect(message.embeds[0].fields?.map((field) => field.name)).toEqual([
            "Part",
            "Configuration",
            "Problem with the Onshape document"
        ]);
        expect(detail(message, "Topic")).toBe("FRCDesignLib");
        expect(detail(message, "From")).toBe("Part menu");
        expect(detail(message, "Browser")).toBe("Test browser");
    });

    it("never lets typed text mention anyone", () => {
        const message = buildReportMessage(report({ message: "@everyone" }));
        expect(message.allowed_mentions).toEqual({ parse: [] });
    });

    it("says whether the reporter was signed in, never who they are", () => {
        expect(detail(buildReportMessage(report()), "Signed in")).toBe("Yes");
        expect(
            detail(buildReportMessage(report({ signedIn: false })), "Signed in")
        ).toBe("No");
    });

    it("says what kind of tab the app was launched in, never which", () => {
        const message = buildReportMessage(
            report({
                diagnostics: {
                    url: "/app/library/frc-design-lib",
                    launch: {
                        elementType: "ASSEMBLY",
                        instanceType: "w",
                        enterprise: true
                    }
                }
            })
        );

        expect(detail(message, "Launched in")).toBe(
            "ASSEMBLY, workspace, Enterprise"
        );
        expect(
            detail(
                buildReportMessage(report({ diagnostics: { url: "/" } })),
                "Launched in"
            )
        ).toBe("Not in Onshape");
    });

    // An Onshape message or a url can carry the reporter's document's id.
    // What Onshape said is what the team needs to read.
    it("carries an error's detail as it came, ids included", () => {
        const detail =
            "Onshape API error 403 on /documents/0123456789abcdef01234567";
        const message = buildReportMessage(
            report({
                diagnostics: {
                    url: "/app/library/frc-design-lib",
                    error: { shown: "Failed.", detail }
                }
            })
        );

        expect(fieldValue(message, "Error")).toContain(detail);
    });

    it("carries the error, fenced so it can't format the post", () => {
        const message = buildReportMessage(
            report({
                part: undefined,
                source: FeedbackSource.ERROR,
                topic: FeedbackTopic.APP,
                category: FeedbackCategory.BUG,
                message: "",
                diagnostics: {
                    url: "https://app.test/",
                    error: {
                        shown: "Failed to insert.",
                        kind: "internal",
                        detail: "```boom```"
                    }
                }
            })
        );

        const error = fieldValue(message, "Error")!;
        expect(error.startsWith("```\n")).toBe(true);
        expect(error).toContain("Failed to insert.");
        expect(error).toContain("detail: '''boom'''");
        expect(message.embeds[0].description).toBe("_No description given._");
    });

    it("stays within Discord's limits however long the parts are", () => {
        const long = "x".repeat(5000);
        const message = buildReportMessage(
            report({
                message: long,
                contact: long,
                userAgent: long,
                diagnostics: {
                    url: long,
                    error: { shown: long, detail: long }
                }
            })
        );
        const length = message.embeds.reduce(
            (total, embed) =>
                total +
                (embed.title?.length ?? 0) +
                embed.description.length +
                (embed.footer?.text.length ?? 0) +
                (embed.fields ?? []).reduce(
                    (sum, field) =>
                        sum + field.name.length + field.value.length,
                    0
                ),
            0
        );

        expect(length).toBeLessThanOrEqual(6000);
        for (const embed of message.embeds) {
            expect(embed.description.length).toBeLessThanOrEqual(4096);
            for (const field of embed.fields ?? []) {
                expect(field.value.length).toBeLessThanOrEqual(1024);
            }
        }
        expect(message.thread_name.length).toBeLessThanOrEqual(100);
    });
});

describe("postToDiscord", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    /** A forum thread's starter message, which is in the thread. */
    const POSTED = { id: "thread-1", channel_id: "thread-1" };

    /** Answers each post in turn with `posts`; anything else is unexpected. */
    function stubDiscord(posts: Response[]) {
        const fetch = vi.fn<typeof globalThis.fetch>((_url, init) => {
            if (init?.method !== "POST") {
                return Promise.reject(new Error("unexpected request"));
            }
            const next = posts.shift();
            return next
                ? Promise.resolve(next)
                : Promise.reject(new Error("unexpected post"));
        });
        vi.stubGlobal("fetch", fetch);
        return fetch;
    }

    /** The bodies of the posts, in order. */
    function postedBodies(fetch: ReturnType<typeof stubDiscord>) {
        return fetch.mock.calls
            .filter(([, init]) => init?.method === "POST")
            .map(
                ([, init]) =>
                    JSON.parse(init!.body as string) as Record<string, unknown>
            );
    }

    it("waits for Discord, and opens a thread named for the report", async () => {
        const fetch = stubDiscord([Response.json(POSTED)]);

        await postToDiscord(WEBHOOK, buildReportMessage(report()));

        const [[url]] = fetch.mock.calls.filter(
            ([, init]) => init?.method === "POST"
        );
        expect((url as URL).searchParams.get("wait")).toBe("true");
        expect(postedBodies(fetch)[0].thread_name).toBe(
            "Bearing's part number"
        );
    });

    it("files the thread under the forum's tags", async () => {
        const fetch = stubDiscord([Response.json(POSTED)]);

        await postToDiscord(
            WEBHOOK,
            buildReportMessage(report({ tagIds: ["t1", "t2"] }))
        );

        expect(postedBodies(fetch)[0].applied_tags).toEqual(["t1", "t2"]);
    });

    it("sends no tags to a forum with none configured", async () => {
        const fetch = stubDiscord([Response.json(POSTED)]);

        await postToDiscord(WEBHOOK, buildReportMessage(report()));

        expect(postedBodies(fetch)[0]).not.toHaveProperty("applied_tags");
    });

    // A stale tag id must not lose the report.
    it("sends a report again untagged when Discord refuses its tags", async () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const fetch = stubDiscord([
            Response.json({ code: 50035 }, { status: 400 }),
            Response.json(POSTED)
        ]);

        await postToDiscord(
            WEBHOOK,
            buildReportMessage(report({ tagIds: ["stale"] }))
        );

        const bodies = postedBodies(fetch);
        expect(bodies).toHaveLength(2);
        expect(bodies[1]).not.toHaveProperty("applied_tags");
        expect(bodies[1].thread_name).toBe("Bearing's part number");
    });

    it("throws when Discord refuses the post", async () => {
        stubDiscord([new Response("nope", { status: 404 })]);

        await expect(
            postToDiscord(WEBHOOK, buildReportMessage(report()))
        ).rejects.toThrow(/Discord answered 404/);
    });
});
