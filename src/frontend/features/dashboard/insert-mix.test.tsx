import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import {
    type AnalyticsTotals,
    emptyTargets
} from "@backend/features/analytics/contract";
import { renderWithProviders } from "../../../__test_utils__/render";
import { FastenMethodBreakdown, InsertMethodBreakdown } from "./insert-mix";

const TOTALS: AnalyticsTotals = {
    inserts: 20,
    appOpens: 0,
    uniqueUsers: 1,
    favoriteInserts: 0,
    quickInserts: 5,
    fastenInserts: 8,
    fastenableInserts: 10,
    preselectedInserts: 2,
    quickFastenerInserts: 3,
    targets: emptyTargets(),
    favorites: 0
};

describe("insert breakdowns", () => {
    it("splits every insert into the menu, quick insert and Quick fastener", () => {
        renderWithProviders(<InsertMethodBreakdown totals={TOTALS} />);
        expect(screen.getByText("12 (60.0%)")).toBeTruthy();
        expect(screen.getByText("5 (25.0%)")).toBeTruthy();
        expect(screen.getByText("3 (15.0%)")).toBeTruthy();
    });

    it("splits a fastenable part's inserts by how they were placed", () => {
        renderWithProviders(<FastenMethodBreakdown totals={TOTALS} />);
        expect(screen.getByText("5 (50.0%)")).toBeTruthy();
        expect(screen.getByText("2 (20.0%)")).toBeTruthy();
        expect(screen.getByText("3 (30.0%)")).toBeTruthy();
    });

    it("says so when nothing is recorded", () => {
        renderWithProviders(
            <FastenMethodBreakdown
                totals={{
                    ...TOTALS,
                    fastenableInserts: 0,
                    preselectedInserts: 0,
                    quickFastenerInserts: 0
                }}
            />
        );
        expect(screen.getByText("None recorded yet.")).toBeTruthy();
    });
});
