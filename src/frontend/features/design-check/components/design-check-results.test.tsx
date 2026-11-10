import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BuildIssueSeverity } from "@backend/features/build-checker/issues";
import {
    type DesignCheckLevelsOut,
    type DesignCheckOut,
    DesignIssueType
} from "@backend/features/design-check/contract";
import { DEFAULT_LIBRARY } from "@backend/features/library/library-id";
import { ElementType } from "@backend/lib/onshape/element-type";
import {
    createTestQueryClient,
    renderWithProviders
} from "../../../../__test_utils__/render";
import { type TargetElement } from "../../../lib/onshape-launch";
import { designCheckLevelsQueryKey } from "../../../lib/query-keys";

const apiPost = vi.hoisted(() =>
    vi.fn((_path: string, options: { body: DesignCheckLevelsOut }) =>
        Promise.resolve(options.body)
    )
);
vi.mock("../../../lib/api-client", () => ({ apiPost }));
vi.mock("../../../lib/library", () => ({
    useLibraryId: () => DEFAULT_LIBRARY
}));

const { DesignCheckResults } = await import("./design-check-results");
const { DesignCheckLevels } = await import("./design-check-levels");

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

afterEach(() => {
    vi.restoreAllMocks();
    apiPost.mockClear();
});

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
        expect(screen.getByText("2 errors")).toBeTruthy();
        expect(screen.getByText("1 info")).toBeTruthy();
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

    it("opens a suppressed mate, but names a suppressed Part Studio feature only", async () => {
        const postMessage = vi
            .spyOn(window.parent, "postMessage")
            .mockImplementation(() => undefined);
        const suppressed = (subject: string, featureId: string) =>
            result({
                issues: [
                    {
                        type: DesignIssueType.FEATURE_SUPPRESSED,
                        subject,
                        featureId
                    }
                ]
            });
        const { unmount } = renderWithProviders(
            <DesignCheckResults
                target={target}
                result={suppressed("Sketch 5", "S5")}
            />
        );

        expect(screen.queryByRole("button", { name: "Sketch 5" })).toBeNull();
        unmount();

        renderWithProviders(
            <DesignCheckResults
                target={{ ...target, elementType: ElementType.ASSEMBLY }}
                result={{
                    ...suppressed("Fastened 2", "M2"),
                    elementType: ElementType.ASSEMBLY
                }}
            />
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Fastened 2" })
        );

        expect(postMessage).toHaveBeenCalledTimes(1);
        expect(postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                messageName: "openFeatureDialog",
                featureId: "M2"
            }),
            "*"
        );
    });

    it("selects a part instance in Onshape when its name is clicked", async () => {
        const postMessage = vi
            .spyOn(window.parent, "postMessage")
            .mockImplementation(() => undefined);
        renderWithProviders(
            <DesignCheckResults
                target={{ ...target, elementType: ElementType.ASSEMBLY }}
                result={result({
                    elementType: ElementType.ASSEMBLY,
                    issues: [
                        {
                            type: DesignIssueType.INSTANCE_BROKEN,
                            subject: "Gone <1>",
                            instanceId: "gone"
                        },
                        {
                            type: DesignIssueType.INSTANCE_FLOATING,
                            subject: "Plate <1>",
                            instanceId: "M1",
                            partId: "JHD"
                        },
                        {
                            type: DesignIssueType.INSTANCE_FLOATING,
                            subject: "Plate <2>",
                            instanceId: "M2",
                            partId: "JHD"
                        }
                    ]
                })}
            />
        );

        await userEvent.click(screen.getByText("Plate <2>"));
        await userEvent.click(screen.getByText("Gone <1>"));

        expect(postMessage).toHaveBeenCalledTimes(1);
        expect(postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                messageName: "requestSelectionHighlight",
                selections: [
                    {
                        selectionType: "ENTITY",
                        entityType: "BODY",
                        selectionId: "JHD",
                        occurrencePath: ["M2"]
                    }
                ],
                documentId: "doc",
                workspaceId: "work",
                elementId: "tab"
            }),
            "*"
        );
    });

    it("selects a part in a Part Studio when its name is clicked", async () => {
        const postMessage = vi
            .spyOn(window.parent, "postMessage")
            .mockImplementation(() => undefined);
        renderWithProviders(
            <DesignCheckResults
                target={target}
                result={result({
                    issues: [
                        {
                            type: DesignIssueType.PART_NO_MATERIAL,
                            subject: "Plate",
                            partId: "JHD"
                        }
                    ]
                })}
            />
        );

        await userEvent.click(screen.getByText("Plate"));

        expect(postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                messageName: "requestSelectionHighlight",
                selections: [
                    {
                        selectionType: "ENTITY",
                        entityType: "BODY",
                        selectionId: "JHD"
                    }
                ]
            }),
            "*"
        );
    });

    it("shows each kind at the caller's level, and counts the ones turned off", async () => {
        const onChangeLevels = vi.fn();
        renderWithProviders(
            <DesignCheckResults
                target={target}
                result={result({
                    issues: [
                        { type: DesignIssueType.ROLLBACK_NOT_AT_END, count: 1 },
                        {
                            type: DesignIssueType.FEATURE_SUPPRESSED,
                            subject: "Sketch 5",
                            featureId: "S5"
                        },
                        {
                            type: DesignIssueType.PART_NO_DESCRIPTION,
                            subject: "Plate",
                            partId: "JHD"
                        }
                    ]
                })}
                levels={{
                    [DesignIssueType.PART_NO_DESCRIPTION]:
                        BuildIssueSeverity.ERROR,
                    [DesignIssueType.FEATURE_SUPPRESSED]: "off"
                }}
                onChangeLevels={onChangeLevels}
            />
        );

        expect(
            screen
                .getAllByText(
                    /^(Part with no description|Rollback bar isn't at the end)$/
                )
                .map((heading) => heading.textContent)
        ).toEqual([
            "Part with no description",
            "Rollback bar isn't at the end"
        ]);
        expect(screen.getByText("1 error")).toBeTruthy();
        expect(screen.getByText("1 info")).toBeTruthy();
        expect(screen.queryByText("Sketch 5")).toBeNull();
        expect(
            screen.getByText(/An issue is hidden by your levels/)
        ).toBeTruthy();

        await userEvent.click(screen.getByText("Change levels"));

        expect(onChangeLevels).toHaveBeenCalledTimes(1);
    });

    it("says when everything it found is turned off", () => {
        renderWithProviders(
            <DesignCheckResults
                target={target}
                result={result({
                    issues: [
                        { type: DesignIssueType.ROLLBACK_NOT_AT_END, count: 1 },
                        { type: DesignIssueType.ORIGIN_CUBE_MISSING }
                    ]
                })}
                levels={{
                    [DesignIssueType.ROLLBACK_NOT_AT_END]: "off",
                    [DesignIssueType.ORIGIN_CUBE_MISSING]: "off"
                }}
            />
        );

        expect(
            screen.getByText("Every issue found is turned off")
        ).toBeTruthy();
        expect(
            screen.getByText(/2 issues are hidden by your levels/)
        ).toBeTruthy();
        expect(screen.queryByText("No issues found")).toBeNull();
    });

    it("doesn't mention what is off by default", () => {
        renderWithProviders(
            <DesignCheckResults
                target={target}
                result={result({
                    issues: [
                        {
                            type: DesignIssueType.PART_NO_PART_NUMBER,
                            subject: "Plate",
                            partId: "JHD"
                        }
                    ]
                })}
            />
        );

        expect(screen.getByText("No issues found")).toBeTruthy();
        expect(screen.queryByText(/hidden by your levels/)).toBeNull();
        expect(screen.queryByText("Plate")).toBeNull();
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

describe("design check levels", () => {
    function renderLevels(levels: DesignCheckLevelsOut["levels"]) {
        const queryClient = createTestQueryClient();
        queryClient.setQueryData<DesignCheckLevelsOut>(
            designCheckLevelsQueryKey(),
            { levels }
        );
        renderWithProviders(<DesignCheckLevels />, queryClient);
    }

    it("saves a change on top of the caller's other levels, and shows it at once", async () => {
        renderLevels({
            [DesignIssueType.PART_NO_DESCRIPTION]: BuildIssueSeverity.INFO
        });

        expect(screen.getByText("FRCDesign's default: Off")).toBeTruthy();

        await userEvent.click(screen.getByLabelText("Under-defined sketch"));
        await userEvent.click(screen.getByRole("option", { name: "Warning" }));

        expect(apiPost).toHaveBeenCalledWith("/design-check/levels", {
            body: {
                levels: {
                    [DesignIssueType.PART_NO_DESCRIPTION]: "info",
                    [DesignIssueType.SKETCH_UNDERDEFINED]: "warning"
                }
            }
        });
        expect(screen.getByText("FRCDesign's default: Error")).toBeTruthy();
    });

    it("leaves out a level put back to FRCDesign's, and resets them all", async () => {
        renderLevels({
            [DesignIssueType.PART_NO_DESCRIPTION]: BuildIssueSeverity.INFO,
            [DesignIssueType.SKETCH_UNDERDEFINED]: BuildIssueSeverity.WARNING
        });

        await userEvent.click(
            screen.getByLabelText("Part with no description")
        );
        await userEvent.click(screen.getByRole("option", { name: "Off" }));
        await userEvent.click(screen.getByText("Reset to defaults"));

        expect(apiPost.mock.calls.map(([, options]) => options.body)).toEqual([
            {
                levels: {
                    [DesignIssueType.SKETCH_UNDERDEFINED]: "warning"
                }
            },
            { levels: {} }
        ]);
        expect(screen.queryByText("Reset to defaults")).toBeNull();
    });

    it("puts the saved levels back when a save fails", async () => {
        apiPost.mockRejectedValueOnce(new Error("offline"));
        renderLevels({
            [DesignIssueType.PART_NO_DESCRIPTION]: BuildIssueSeverity.INFO
        });

        await userEvent.click(
            screen.getByLabelText("Part with no description")
        );
        await userEvent.click(screen.getByRole("option", { name: "Off" }));

        expect(
            await screen.findByText("FRCDesign's default: Off")
        ).toBeTruthy();
    });
});
