import { afterEach, describe, expect, it, vi } from "vitest";
import { FeedbackCategory, FeedbackSource, FeedbackTopic } from "./contract";
import { buildReportMessage, postToDiscord, type Report } from "./discord";

const WEBHOOK = "https://discord.com/api/webhooks/1/token";

function report(overrides: Partial<Report> = {}): Report {
    return {
        id: "report-1",
        topic: FeedbackTopic.FRC_DESIGN_LIB,
        category: FeedbackCategory.METADATA,
        source: FeedbackSource.PART,
        message: "The part number is wrong.",
        userId: "user-1",
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
    return message.embeds[0].fields.find((field) => field.name === name)?.value;
}

describe("buildReportMessage", () => {
    it("names the kind and the part, and links to it", () => {
        const message = buildReportMessage(report());
        const [embed] = message.embeds;

        expect(embed.title).toBe("Missing or incorrect metadata: Bearing");
        expect(embed.url).toBe("https://cad.onshape.com/documents/d/v/v/e/e");
        expect(embed.description).toBe("The part number is wrong.");
        expect(fieldValue(message, "Part")).toBe("Bearings / Bearing");
        expect(fieldValue(message, "Configuration")).toContain("Size: 1/2 in");
        expect(embed.footer.text).toBe("Report report-1");
    });

    it("never lets typed text mention anyone", () => {
        const message = buildReportMessage(report({ message: "@everyone" }));
        expect(message.allowed_mentions).toEqual({ parse: [] });
    });

    it("says who sent it, or that they weren't signed in", () => {
        expect(fieldValue(buildReportMessage(report()), "Onshape user")).toBe(
            "user-1"
        );
        expect(
            fieldValue(
                buildReportMessage(report({ userId: undefined })),
                "Onshape user"
            )
        ).toBe("Not signed in");
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
        expect(message.embeds[0].title).toBe("Bug: FRCDesignApp");
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
        const [embed] = message.embeds;
        const length =
            embed.title.length +
            embed.description.length +
            embed.footer.text.length +
            embed.fields.reduce(
                (sum, field) => sum + field.name.length + field.value.length,
                0
            );

        expect(length).toBeLessThanOrEqual(6000);
        for (const field of embed.fields) {
            expect(field.value.length).toBeLessThanOrEqual(1024);
        }
        expect(message.thread_name!.length).toBeLessThanOrEqual(100);
    });
});

describe("postToDiscord", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    function stubFetch(...responses: Response[]) {
        const fetch = vi.fn<typeof globalThis.fetch>();
        for (const response of responses) {
            fetch.mockResolvedValueOnce(response);
        }
        vi.stubGlobal("fetch", fetch);
        return fetch;
    }

    function sentBody(fetch: ReturnType<typeof stubFetch>, call: number) {
        return JSON.parse(fetch.mock.calls[call][1]!.body as string) as Record<
            string,
            unknown
        >;
    }

    it("waits for Discord, and sends a text channel no thread", async () => {
        const fetch = stubFetch(new Response("{}", { status: 200 }));

        await postToDiscord(WEBHOOK, buildReportMessage(report()));

        expect(fetch).toHaveBeenCalledTimes(1);
        const url = fetch.mock.calls[0][0] as URL;
        expect(url.searchParams.get("wait")).toBe("true");
        expect(sentBody(fetch, 0)).not.toHaveProperty("thread_name");
    });

    it("opens a thread once Discord says the channel is a forum", async () => {
        const fetch = stubFetch(
            Response.json({ code: 220001 }, { status: 400 }),
            new Response("{}", { status: 200 })
        );

        await postToDiscord(WEBHOOK, buildReportMessage(report()));

        expect(fetch).toHaveBeenCalledTimes(2);
        expect(sentBody(fetch, 1).thread_name).toBe(
            "Missing or incorrect metadata: Bearing"
        );
    });

    it("throws when Discord refuses the post", async () => {
        stubFetch(new Response("nope", { status: 404 }));

        await expect(
            postToDiscord(WEBHOOK, buildReportMessage(report()))
        ).rejects.toThrow(/Discord answered 404/);
    });
});
