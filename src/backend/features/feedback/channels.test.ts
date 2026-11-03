import { afterEach, describe, expect, it } from "vitest";
import {
    FEEDBACK_TOPICS,
    feedbackCategories,
    FeedbackCategory,
    FeedbackSource,
    FeedbackTopic,
    topicLibrary
} from "./contract";
import { DISCORD_FORUMS, DiscordForum, topicForum } from "./discord-forums";
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

describe("DISCORD_FORUMS", () => {
    // A thread with no type tag is one the forum's triage can't sort.
    it.each(FEEDBACK_TOPICS)(
        "tags every type a %s report can take",
        (topic) => {
            const { tags } = topicForum(topic);
            // A part report is always about a library's part.
            const sources = topicLibrary(topic)
                ? Object.values(FeedbackSource)
                : [FeedbackSource.GENERAL, FeedbackSource.ERROR];
            const types = sources.flatMap((source) =>
                feedbackCategories(topic, source)
            );
            // Kudos has no tag in any forum yet.
            const untagged = types.filter(
                (type) =>
                    tags[type] === undefined && type !== FeedbackCategory.KUDOS
            );
            expect(untagged).toEqual([]);
        }
    );
});
