import { describe, expect, it } from "vitest";
import { migrateUiState, SectionId } from "./ui-state";

describe("migrateUiState", () => {
    it("carries a page section's saved open state into sections", () => {
        const migrated = migrateUiState(
            { theme: "light", isFavoritesOpen: true, isChildrenOpen: false },
            0
        );
        expect(migrated.sections).toEqual({
            [SectionId.FAVORITES]: true,
            [SectionId.CHILDREN]: false
        });
        expect(migrated.theme).toBe("light");
        expect(migrated).not.toHaveProperty("isFavoritesOpen");
    });

    it("leaves current state alone", () => {
        const state = { sections: { [SectionId.USAGE]: false } };
        expect(migrateUiState(state, 1)).toBe(state);
    });
});
