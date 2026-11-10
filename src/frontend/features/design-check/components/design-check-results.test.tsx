import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
    type DesignCheckOut,
    DesignIssueType
} from "@backend/features/design-check/contract";
import { ElementType } from "@backend/lib/onshape/element-type";
import { renderWithProviders } from "../../../../__test_utils__/render";
import { type TargetElement } from "../../../lib/onshape-launch";
import { DesignCheckResults } from "./design-check-results";

const target: TargetElement = {
    documentId: "doc",
    instanceId: "work",
    instanceType: "w",
    elementId: "tab",
    elementType: ElementType.PART_STUDIO
};

function result(overrides: Partial<DesignCheckOut> = {}): DesignCheckOut {
    return {
        elementType: ElementType.PART_STUDIO,
        issues: [],
        sketchStatusUnknown: false,
        checkedAt: Date.UTC(2026, 10, 9, 18, 30),
        ...overrides
    };
}

afterEach(() => vi.restoreAllMocks());

describe("design check results", () => {
    it("says when there is nothing to fix", () => {
        renderWithProviders(
            <DesignCheckResults target={target} result={result()} />
        );

        expect(screen.getByText("No issues found")).toBeTruthy();
        expect(
            screen.getByText(
                "This Part Studio follows every practice the design check looks for."
            )
        ).toBeTruthy();
    });

    it("lists each kind of issue once, naming everything it was found on", () => {
        renderWithProviders(
            <DesignCheckResults
                target={target}
                result={result({
                    issues: [
                        {
                            type: DesignIssueType.PART_NO_MATERIAL,
                            subject: "Plate",
                            partId: "JHD"
                        },
                        {
                            type: DesignIssueType.PART_NO_MATERIAL,
                            subject: "Spacer",
                            partId: "JKD"
                        },
                        {
                            type: DesignIssueType.ROLLBACK_NOT_AT_END,
                            count: 3
                        }
                    ]
                })}
            />
        );

        expect(screen.getAllByText("Part with no material")).toHaveLength(1);
        expect(screen.getByText("Plate")).toBeTruthy();
        expect(screen.getByText("Spacer")).toBeTruthy();
        expect(
            screen.getByText(
                "It leaves 3 features out of the model. Drag it to the bottom of the list."
            )
        ).toBeTruthy();
        expect(screen.getByText("3 warnings")).toBeTruthy();
    });

    it("opens a feature in Onshape when its name is clicked", async () => {
        const postMessage = vi
            .spyOn(window.parent, "postMessage")
            .mockImplementation(() => undefined);
        renderWithProviders(
            <DesignCheckResults
                target={target}
                result={result({
                    issues: [
                        {
                            type: DesignIssueType.SKETCH_UNDERDEFINED,
                            subject: "Sketch 1",
                            featureId: "S1"
                        }
                    ]
                })}
            />
        );

        await userEvent.click(screen.getByText("Sketch 1"));

        expect(postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                messageName: "openFeatureDialog",
                featureId: "S1",
                documentId: "doc",
                workspaceId: "work",
                elementId: "tab"
            }),
            "*"
        );
    });

    it("says when sketches went unchecked", () => {
        renderWithProviders(
            <DesignCheckResults
                target={target}
                result={result({ sketchStatusUnknown: true })}
            />
        );

        expect(
            screen.getByText(/under-defined sketches weren't checked/)
        ).toBeTruthy();
    });
});
