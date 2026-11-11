import { afterEach, describe, expect, it, vi } from "vitest";
import { ModalsProvider } from "@mantine/modals";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
    type DesignCheckOut,
    type DesignIssue,
    DesignIssueFix,
    DesignIssueType,
    type TabCheck
} from "@backend/features/design-check/contract";
import { ElementType } from "@backend/lib/onshape/element-type";
import { renderWithProviders } from "../../../../__test_utils__/render";
import { type TargetElement } from "../../../lib/onshape-launch";
import { DesignCheckResults } from "./design-check-results";

const apiPost = vi.hoisted(() =>
    vi.fn<(path: string, options?: object) => Promise<object>>(() =>
        Promise.resolve({})
    )
);
vi.mock("../../../lib/api-client", () => ({ apiPost }));

const target: TargetElement = {
    documentId: "doc",
    instanceId: "work",
    instanceType: "w",
    elementId: "tab",
    elementType: ElementType.PART_STUDIO
};

function tab(overrides: Partial<TabCheck> = {}): TabCheck {
    return {
        elementId: "tab",
        name: "Part Studio 1",
        elementType: ElementType.PART_STUDIO,
        issues: [],
        sketchStatusUnknown: false,
        failed: false,
        ...overrides
    };
}

interface LaunchTab {
    issues?: DesignIssue[];
    sketchStatusUnknown?: boolean;
    elementType?: ElementType;
    /** Tabs after the launch's. */
    others?: TabCheck[];
}

/** A check whose first tab is the launch's. */
function result(launch: LaunchTab = {}): DesignCheckOut {
    const { others = [], ...launchTab } = launch;
    return {
        tabs: [tab(launchTab), ...others],
        checkedAt: Date.UTC(2026, 10, 9, 18, 30)
    };
}

afterEach(() => {
    vi.restoreAllMocks();
    apiPost.mockReset();
    apiPost.mockResolvedValue({});
});

describe("design check results", () => {
    it("says when there is nothing to fix", () => {
        renderWithProviders(
            <DesignCheckResults target={target} result={result()} />
        );

        expect(screen.getByText("No issues found")).toBeTruthy();
        expect(
            screen.getByText(
                "Every Part Studio and Assembly in this document follows every practice the design check looks for."
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
        // The document's count, and its one tab's.
        expect(screen.getAllByText("3 warnings")).toHaveLength(2);
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
        const suppressed = (
            subject: string,
            featureId: string,
            elementType = ElementType.PART_STUDIO
        ) =>
            result({
                elementType,
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
                result={suppressed("Fastened 2", "M2", ElementType.ASSEMBLY)}
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

    it("selects a part while hovered, and keeps it selected once clicked", async () => {
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
        const plate = screen.getByRole("button", { name: "Plate" });
        const selections = () =>
            postMessage.mock.calls.map(
                ([message]) =>
                    (message as { selections: { selectionId: string }[] })
                        .selections
            );

        await userEvent.hover(plate);
        await userEvent.unhover(plate);

        expect(selections()).toEqual([
            [expect.objectContaining({ selectionId: "JHD" })],
            []
        ]);

        postMessage.mockClear();
        await userEvent.click(plate);
        await userEvent.unhover(plate);

        expect(selections()).toEqual([
            [expect.objectContaining({ selectionId: "JHD" })]
        ]);
    });

    it("names another tab's issues only, and switches to that tab", async () => {
        const postMessage = vi
            .spyOn(window.parent, "postMessage")
            .mockImplementation(() => undefined);
        renderWithProviders(
            <DesignCheckResults
                target={target}
                result={result({
                    others: [
                        tab({
                            elementId: "asm",
                            name: "Assembly 1",
                            elementType: ElementType.ASSEMBLY,
                            issues: [
                                {
                                    type: DesignIssueType.INSTANCE_FLOATING,
                                    subject: "Plate <1>",
                                    instanceId: "M1",
                                    partId: "JHD"
                                }
                            ]
                        })
                    ]
                })}
            />
        );

        expect(screen.getByText("Nothing to fix in this tab.")).toBeTruthy();
        expect(screen.getByText("This tab")).toBeTruthy();

        await userEvent.click(screen.getByText("Assembly 1"));

        expect(screen.getByText("Plate <1>")).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Plate <1>" })).toBeNull();

        await userEvent.click(
            screen.getByRole("button", { name: "Switch to this tab" })
        );

        expect(postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                messageName: "openAnotherElementInCurrentWorkspace",
                anotherElementId: "asm",
                elementId: "tab"
            }),
            "*"
        );
    });

    it("says a tab Onshape failed on went unchecked", async () => {
        renderWithProviders(
            <DesignCheckResults
                target={target}
                result={result({
                    others: [
                        tab({
                            elementId: "asm",
                            name: "Assembly 1",
                            failed: true
                        })
                    ]
                })}
            />
        );

        expect(screen.queryByText("No issues found")).toBeNull();
        expect(screen.getByText("Not checked")).toBeTruthy();

        await userEvent.click(screen.getByText("Assembly 1"));

        expect(screen.getByText("Failed to check this tab.")).toBeTruthy();
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

    it("confirms one fix, and makes it", async () => {
        renderWithProviders(
            <ModalsProvider>
                <DesignCheckResults
                    target={{ ...target, elementType: ElementType.ASSEMBLY }}
                    result={result({
                        elementType: ElementType.ASSEMBLY,
                        issues: [
                            {
                                type: DesignIssueType.INSTANCE_BROKEN,
                                subject: "Gone <1>",
                                instanceId: "gone",
                                fix: DesignIssueFix.DELETE_INSTANCE
                            }
                        ]
                    })}
                />
            </ModalsProvider>
        );

        await userEvent.click(screen.getByRole("button", { name: "Delete" }));

        expect(await screen.findByText("Delete Gone <1>")).toBeTruthy();
        await userEvent.click(
            screen.getByRole("button", { name: "Make 1 fix" })
        );

        expect(apiPost).toHaveBeenCalledWith("/design-check/fix", {
            body: {
                documentId: "doc",
                instanceId: "work",
                elementId: "tab",
                fix: DesignIssueFix.DELETE_INSTANCE,
                assemblyInstanceId: "gone"
            }
        });
    });

    it("lists every fix in the document under Fix all, making only those left checked", async () => {
        renderWithProviders(
            <ModalsProvider>
                <DesignCheckResults
                    target={target}
                    result={result({
                        issues: [
                            {
                                type: DesignIssueType.ROLLBACK_NOT_AT_END,
                                count: 1,
                                fix: DesignIssueFix.MOVE_ROLLBACK_TO_END
                            }
                        ],
                        others: [
                            tab({
                                elementId: "asm",
                                name: "Assembly 1",
                                elementType: ElementType.ASSEMBLY,
                                issues: [
                                    {
                                        type: DesignIssueType.INSTANCE_BROKEN,
                                        subject: "Gone <1>",
                                        instanceId: "gone",
                                        fix: DesignIssueFix.DELETE_INSTANCE
                                    }
                                ]
                            })
                        ]
                    })}
                />
            </ModalsProvider>
        );

        await userEvent.click(screen.getByRole("button", { name: "Fix all" }));
        await userEvent.click(await screen.findByLabelText("Delete Gone <1>"));
        await userEvent.click(
            screen.getByRole("button", { name: "Make 1 fix" })
        );

        expect(apiPost.mock.calls).toEqual([
            [
                "/design-check/fix",
                {
                    body: expect.objectContaining({
                        elementId: "tab",
                        fix: DesignIssueFix.MOVE_ROLLBACK_TO_END
                    })
                }
            ]
        ]);
    });
});
