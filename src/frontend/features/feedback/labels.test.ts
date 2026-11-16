import { describe, expect, it } from "vitest";
import { FeedbackCategory } from "@backend/features/feedback/contract";
import { suggestTitle } from "./labels";

describe("suggestTitle", () => {
    it("names the type and the part", () => {
        expect(
            suggestTitle({
                category: FeedbackCategory.BROKEN_CONFIGURATION,
                subject: "Hex Shaft"
            })
        ).toBe("Broken configuration: Hex Shaft");
    });

    it("is none for feedback about no part or error", () => {
        expect(
            suggestTitle({ category: FeedbackCategory.PART_REQUEST })
        ).toBeUndefined();
    });

    it("is the error the user was shown, without its period", () => {
        expect(
            suggestTitle({
                category: FeedbackCategory.BUG,
                errorShown: "Failed to insert Bearing."
            })
        ).toBe("Failed to insert Bearing");
    });

    it("fits a thread's name", () => {
        const title = suggestTitle({
            category: FeedbackCategory.BUG,
            errorShown: "x".repeat(300)
        });
        expect(title).toHaveLength(100);
    });
});
