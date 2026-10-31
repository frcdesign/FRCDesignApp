import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../__test_utils__/render";
import { DEFAULT_LIBRARY } from "@backend/features/library/library-id";
import type { InsertableReportOut } from "@backend/features/analytics/contract";
import { getInsertableReportQuery } from "../../dashboard/dashboard-queries";
import { RangePreset, toDayRange } from "../../dashboard/range";

vi.mock("../../../lib/library", () => ({
    useLibraryId: () => DEFAULT_LIBRARY
}));

const { UsageSection } = await import("./usage-section");
const { updateUiState } = await import("../../../lib/ui-state");

const report: InsertableReportOut = {
    name: "Gearbox",
    path: {
        documentId: "d",
        instanceType: "v",
        instanceId: "v",
        elementId: "e1"
    },
    insertCount: 1240,
    usesPerMonth: 85,
    uniqueUsers: 310,
    favorites: 42,
    targets: { PARTSTUDIO: 1000, ASSEMBLY: 240 },
    parameters: []
};

describe("usage section", () => {
    afterEach(() => updateUiState({ cardSections: {} }));

    it("shows the part's all-time numbers", async () => {
        const { queryClient } = renderWithProviders(
            <UsageSection elementId="e1" />
        );
        queryClient.setQueryData(
            getInsertableReportQuery(
                DEFAULT_LIBRARY,
                "e1",
                toDayRange(RangePreset.ALL)
            ).queryKey,
            report
        );

        expect(await screen.findByText("1,240")).toBeTruthy();
        expect(screen.getByText("85")).toBeTruthy();
        expect(screen.getByText("310")).toBeTruthy();
        expect(screen.getByText("42")).toBeTruthy();
    });

    it("links to the part's dashboard report", () => {
        renderWithProviders(<UsageSection elementId="e1" />);
        expect(
            screen.getByText("Dashboard").closest("a")?.getAttribute("href")
        ).toBe(`/dashboard/library/${DEFAULT_LIBRARY}/part?element=e1`);
    });
});

describe("usage section, closed", () => {
    afterEach(() => updateUiState({ cardSections: {} }));

    it("keeps its link, and asks for nothing", () => {
        updateUiState({ cardSections: { usage: false } });
        const { queryClient } = renderWithProviders(
            <UsageSection elementId="e1" />
        );
        expect(screen.getByText("Dashboard")).toBeTruthy();
        expect(screen.queryByText("Inserts")).toBeNull();
        expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    });
});
