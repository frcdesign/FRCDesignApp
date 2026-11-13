import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { EditCheckOut } from "@backend/features/edit-parts/contract";
import {
    type ConfigurationParameter,
    ParameterType
} from "@backend/features/configurations/contract";
import type { InsertableOut } from "@backend/features/library/contract";
import { ElementType } from "@backend/lib/onshape/element-type";
import { renderWithProviders } from "../../../../__test_utils__/render";
import { ContextBar } from "../../../components/context-bar";
import { apiPost } from "../../../lib/api-client";
import { useOnshapeLaunch } from "../../../lib/onshape-params";
import { queryClient } from "../../../lib/query-client";
import {
    configurationQueryKey,
    editCheckQueryKey
} from "../../../lib/query-keys";
import {
    type OnshapeSelection,
    toSelectedEntities,
    useOnshapeSelection
} from "../../../lib/selection";
import { setEditParts, useEditPicks } from "../edit-picks";
import { openEditMenu } from "../open-edit-menu";
import { EditMenuContent } from "./edit-menu";

vi.mock("../../auth/access-level", () => ({ useIsSignedIn: () => true }));
vi.mock("../open-edit-menu", () => ({ openEditMenu: vi.fn() }));
vi.mock("../../../lib/api-client", () => ({
    apiGet: vi.fn(() => new Promise(() => undefined)),
    apiPost: vi.fn(() => Promise.resolve({ updated: 3 }))
}));

const ASSEMBLY = {
    documentId: "doc",
    instanceId: "ws",
    instanceType: "w",
    elementId: "asm",
    elementType: ElementType.ASSEMBLY
} as const;

const SCREW: InsertableOut = {
    id: "ins",
    elementId: "el",
    groupId: "group",
    documentId: "lib",
    versionId: "ver",
    path: {
        documentId: "lib",
        instanceType: "v",
        instanceId: "ver",
        elementId: "el"
    },
    name: "Button head screw",
    microversionId: "mv",
    isVisible: true,
    supportsFasten: true,
    elementType: ElementType.PART_STUDIO,
    isConfigurable: true,
    vendors: []
};

vi.mock("../../library/queries", () => ({
    useLibraryQuery: () => ({ data: { insertables: { ins: SCREW } } })
}));

const PARAMETERS: ConfigurationParameter[] = [
    {
        type: ParameterType.BOOLEAN,
        id: "threads",
        name: "Threads",
        default: "false"
    }
];

const body = (id: string): OnshapeSelection => ({
    entityType: "BODY",
    selectionId: "JHD",
    occurrencePath: [id]
});

const CHECK: EditCheckOut = {
    insertableId: SCREW.id,
    selection: { threads: "false" },
    pickedCount: 1,
    matchingCount: 3,
    problems: []
};

function selectInOnshape(pick: OnshapeSelection) {
    act(() => {
        const { shown, receive } = useOnshapeSelection.getState();
        receive([...shown, pick]);
    });
}

describe("edit parts", () => {
    beforeEach(() => {
        useOnshapeLaunch.setState({
            ...ASSEMBLY,
            server: "https://cad.onshape.com"
        });
    });

    afterEach(() => {
        queryClient.clear();
        vi.mocked(apiPost).mockClear();
        vi.mocked(openEditMenu).mockClear();
        setEditParts([]);
        useOnshapeSelection.setState({
            focused: undefined,
            active: undefined,
            isFinished: false,
            shown: [],
            awaited: undefined,
            filtering: undefined
        });
    });

    it("picks whole parts from the bar, opens the menu on them, and drops them on Cancel", async () => {
        queryClient.setQueryData(
            editCheckQueryKey({
                assembly: ASSEMBLY,
                parts: toSelectedEntities([body("a")])
            }),
            CHECK
        );
        renderWithProviders(<ContextBar isLibrary />, queryClient);
        await userEvent.click(
            screen.getByRole("button", { name: "Edit parts" })
        );
        expect(useOnshapeSelection.getState().active).toBe("edit-parts");
        expect(screen.getByRole("button", { name: "Edit" })).toHaveProperty(
            "disabled",
            true
        );

        selectInOnshape(body("a"));
        expect(screen.getByText("Part 1")).toBeTruthy();
        await waitFor(() =>
            expect(screen.getByRole("button", { name: "Edit" })).toHaveProperty(
                "disabled",
                false
            )
        );
        await userEvent.click(screen.getByRole("button", { name: "Edit" }));
        expect(openEditMenu).toHaveBeenCalledWith(
            expect.objectContaining({ insertable: SCREW, check: CHECK })
        );

        await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(useEditPicks.getState().parts).toEqual([]);
        expect(screen.queryByText("Parts to edit")).toBeNull();
    });

    it("sends only what changed, to every copy configured the same unless unticked", async () => {
        queryClient.setQueryData(configurationQueryKey(SCREW.id, "mv"), {
            parameters: PARAMETERS,
            records: []
        });
        renderWithProviders(
            <EditMenuContent
                assembly={ASSEMBLY}
                insertable={SCREW}
                parts={[body("a")]}
                check={CHECK}
            />,
            queryClient
        );
        const update = screen.getByRole("button", { name: "Update" });
        expect(update).toHaveProperty("disabled", true);
        expect(
            screen.getByText(
                "Mates to these parts are deleted. Fasten them again by hand."
            )
        ).toBeTruthy();

        await userEvent.click(screen.getByLabelText("Threads"));
        await userEvent.click(
            screen.getByLabelText("Apply to all 3 with the same configuration")
        );
        await userEvent.click(update);

        expect(apiPost).toHaveBeenCalledWith("/edit-parts", {
            body: {
                assembly: ASSEMBLY,
                parts: toSelectedEntities([body("a")]),
                changes: { threads: "true" },
                applyToAll: false
            }
        });
    });
});
