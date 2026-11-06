import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../__test_utils__/render";
import { DEFAULT_LIBRARY } from "@backend/features/library/library-id";
import { getPartsQuery } from "../../dashboard/dashboard-queries";
import { partUsage } from "../../../../__test_utils__/part-usage-fixtures";
import { RangePreset, toDayRange } from "../../dashboard/range";

vi.mock("../../../lib/library", () => ({
    useLibraryId: () => DEFAULT_LIBRARY
}));

const { UsageSection } = await import("./usage-section");
const { CardSections } = await import("./card-section");
const { updateUiState } = await import("../../../lib/ui-state");

function renderUsage() {
    return renderWithProviders(
        <CardSections
            sections={[<UsageSection key="usage" elementId="e1" />]}
        />
    );
}

function dashboardLink(): string | null | undefined {
    return document.querySelector("a")?.getAttribute("href");
}

const parts = [
    partUsage({ elementId: "other", insertCount: 3 }),
    partUsage({
        elementId: "e1",
        insertCount: 1240,
        usesPerMonth: 85,
        favorites: 42
    })
];

describe("usage section", () => {
    afterEach(() => updateUiState({ sections: {} }));

    it("shows the part's all-time numbers", async () => {
        const { queryClient } = renderUsage();
        queryClient.setQueryData(
            getPartsQuery(DEFAULT_LIBRARY, toDayRange(RangePreset.ALL))
                .queryKey,
            parts
        );

        expect(await screen.findByText("1,240")).toBeTruthy();
        expect(screen.getByText("85")).toBeTruthy();
        expect(screen.getByText("42")).toBeTruthy();
    });

    it("links to the part's dashboard report", () => {
        renderUsage();
        expect(dashboardLink()).toBe(
            `/dashboard/library/${DEFAULT_LIBRARY}/part?element=e1`
        );
    });
});

describe("usage section, closed", () => {
    afterEach(() => updateUiState({ sections: {} }));

    it("asks for nothing", () => {
        updateUiState({ sections: { usage: false } });
        const { queryClient } = renderUsage();
        expect(screen.queryByText("Inserts")).toBeNull();
        expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    });
});
