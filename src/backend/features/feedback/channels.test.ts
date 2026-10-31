import { afterEach, describe, expect, it } from "vitest";
import { FeedbackCategory, FeedbackSource, FeedbackTopic } from "./contract";
import { DISCORD_FORUMS, DiscordForum } from "./discord-forums";
import { reportTagIds } from "./channels";

const library = DISCORD_FORUMS[DiscordForum.LIBRARY];
const shipped = library.tags;

describe("reportTagIds", () => {
    afterEach(() => {
        library.tags = shipped;
    });

    it("files a report under its topic, its type, and Error report when it came from one", () => {
        library.tags = {
            [FeedbackTopic.MKCAD]: "tag-mkcad",
            [FeedbackTopic.FRC_DESIGN_LIB]: "tag-frc",
            [FeedbackCategory.BUG]: "tag-bug",
            "error-report": "tag-error"
        };

        expect(
            reportTagIds(
                FeedbackTopic.MKCAD,
                FeedbackCategory.BUG,
                FeedbackSource.ERROR
            )
        ).toEqual(["tag-mkcad", "tag-bug", "tag-error"]);
        expect(
            reportTagIds(
                FeedbackTopic.MKCAD,
                FeedbackCategory.BUG,
                FeedbackSource.GENERAL
            )
        ).toEqual(["tag-mkcad", "tag-bug"]);
    });

    it("leaves off a tag the forum has no id for", () => {
        library.tags = { [FeedbackCategory.BUG]: "tag-bug" };

        expect(
            reportTagIds(
                FeedbackTopic.FRC_DESIGN_LIB,
                FeedbackCategory.BUG,
                FeedbackSource.GENERAL
            )
        ).toEqual(["tag-bug"]);
    });
});
