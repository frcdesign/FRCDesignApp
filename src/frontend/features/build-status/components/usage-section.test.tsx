import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { type QueryClient } from "@tanstack/react-query";
import { renderWithProviders } from "../../../../__test_utils__/render";
import { DEFAULT_LIBRARY } from "@backend/features/library/library-id";
import { getPartsQuery } from "../../dashboard/dashboard-queries";
import { partUsage } from "../../../../__test_utils__/part-usage-fixtures";
import { RangePreset, toDayRange } from "../../dashboard/range";

vi.mock("../../../lib/library", () => ({
    useLibraryId: () => DEFAULT_LIBRARY
}));

const { GroupUsageSection, PartUsageSection } = await import("./usage-section");
const { CardSections } = await import("./card-section");
const { updateUiState } = await import("../../../lib/ui-state");

const PART_DASHBOARD = `/dashboard/library/${DEFAULT_LIBRARY}/part?element=e1`;

function renderUsage(
    section = <PartUsageSection key="usage" elementId="e1" />
) {
    return renderWithProviders(<CardSections sections={[section]} />);
}

function renderGroupUsage(elementIds: string[]) {
    return renderUsage(
        <GroupUsageSection key="usage" elementIds={elementIds} />
    );
}

function seedParts(queryClient: QueryClient) {
    queryClient.setQueryData(
        getPartsQuery(DEFAULT_LIBRARY, toDayRange(RangePreset.ALL)).queryKey,
        parts
    );
}

function dashboardLink(): string | null | undefined {
    return document.querySelector("a")?.getAttribute("href");
}

const parts = [
    partUsage({
        elementId: "other",
        useCount: 3,
        usesPerMonth: 5,
        favorites: 2
    }),
    partUsage({
        elementId: "e1",
        useCount: 1240,
        usesPerMonth: 85,
        favorites: 42
    })
];

describe("usage section", () => {
    afterEach(() => updateUiState({ sections: {} }));

    it("shows the part's all-time numbers", async () => {
        const { queryClient } = renderUsage();
        seedParts(queryClient);

        expect(await screen.findByText("1,240")).toBeTruthy();
        expect(screen.getByText("85")).toBeTruthy();
        expect(screen.getByText("42")).toBeTruthy();
    });

    it("totals a group's parts", async () => {
        const { queryClient } = renderGroupUsage(["e1", "other", "unlisted"]);
        seedParts(queryClient);

        expect(await screen.findByText("1,243")).toBeTruthy();
        expect(screen.getByText("90")).toBeTruthy();
        expect(screen.getByText("44")).toBeTruthy();
    });

    it("shows no numbers for parts the report doesn't list", async () => {
        const { queryClient } = renderGroupUsage(["unlisted"]);
        seedParts(queryClient);

        expect(await screen.findAllByText("—")).toHaveLength(3);
    });

    it("links to the part's report from its header", () => {
        renderUsage();
        expect(dashboardLink()).toBe(PART_DASHBOARD);
    });

    it("links a group to its library's report", () => {
        renderGroupUsage(["e1"]);
        expect(dashboardLink()).toBe(`/dashboard/library/${DEFAULT_LIBRARY}`);
    });
});

describe("usage section, closed", () => {
    afterEach(() => updateUiState({ sections: {} }));

    it("asks for nothing, and still links to the dashboard", () => {
        updateUiState({ sections: { usage: false } });
        const { queryClient } = renderUsage();
        expect(screen.queryByText("Uses")).toBeNull();
        expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
        expect(dashboardLink()).toBe(PART_DASHBOARD);
    });
});
