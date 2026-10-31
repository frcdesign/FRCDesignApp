import { describe, expect, it } from "vitest";
import { FeedbackCategory, FeedbackTopic, suggestTitle } from "./contract";

describe("suggestTitle", () => {
    it("names the type and the part", () => {
        expect(
            suggestTitle({
                topic: FeedbackTopic.FRC_DESIGN_LIB,
                category: FeedbackCategory.BROKEN_CONFIGURATION,
                partName: "Hex Shaft"
            })
        ).toBe("Broken configuration: Hex Shaft");
    });

    it("names the type and the topic when there is no part", () => {
        expect(
            suggestTitle({
                topic: FeedbackTopic.MKCAD,
                category: FeedbackCategory.PART_REQUEST
            })
        ).toBe("New part request: MKCad");
    });

    it("is the error the user was shown, without its period", () => {
        expect(
            suggestTitle({
                topic: FeedbackTopic.APP,
                category: FeedbackCategory.BUG,
                errorShown: "Failed to insert Bearing."
            })
        ).toBe("Failed to insert Bearing");
    });

    it("fits a thread's name", () => {
        const title = suggestTitle({
            topic: FeedbackTopic.APP,
            category: FeedbackCategory.BUG,
            errorShown: "x".repeat(300)
        });
        expect(title).toHaveLength(100);
    });
});
