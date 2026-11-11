import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type InsertableOut } from "@backend/features/library/contract";
import { UseSource } from "@backend/features/analytics/usage";
import { ElementType } from "@backend/lib/onshape/element-type";
import { renderWithProviders } from "../../../../__test_utils__/render";
import { useOnshapeLaunch } from "../../../lib/onshape-params";
import { updateUiState } from "../../../lib/ui-state";

const mutate = vi.hoisted(() => vi.fn());
vi.mock("../queries", () => ({
    useInsertMutation: () => ({ mutate, isPending: false })
}));

const { QuickInsertButton } = await import("./quick-insert-button");

const SHAFT: InsertableOut = {
    id: "ins",
    elementId: "el",
    groupId: "group",
    documentId: "doc",
    versionId: "ver",
    path: {
        documentId: "doc",
        instanceType: "v",
        instanceId: "ver",
        elementId: "el"
    },
    name: "Hex shaft",
    microversionId: "mv",
    isVisible: true,
    supportsFasten: true,
    elementType: ElementType.PART_STUDIO,
    isConfigurable: false,
    vendors: []
};

function launchIn(elementType: ElementType) {
    useOnshapeLaunch.setState({
        documentId: "d",
        instanceType: "w",
        instanceId: "w",
        elementId: "e",
        elementType
    });
}

function renderButton(insertable: InsertableOut = SHAFT) {
    renderWithProviders(
        <QuickInsertButton
            insertable={insertable}
            isFavorite={false}
            source={UseSource.BROWSE}
        />
    );
}

describe("QuickInsertButton", () => {
    afterEach(() => {
        mutate.mockReset();
    });

    it("offers nothing standalone", () => {
        renderButton();
        expect(screen.queryByRole("button")).toBeNull();
    });

    it("derives into a Part Studio", async () => {
        launchIn(ElementType.PART_STUDIO);
        renderButton();

        await userEvent.click(screen.getByRole("button", { name: "Derive" }));
        expect(mutate).toHaveBeenCalledWith(false);
    });

    it("inserts into an assembly, fastening as the insert menu would", async () => {
        launchIn(ElementType.ASSEMBLY);
        updateUiState({ fasten: true });
        renderButton();

        await userEvent.click(screen.getByRole("button", { name: "Insert" }));
        expect(mutate).toHaveBeenCalledWith(true);
    });

    it("holds an assembly back from a Part Studio, saying why", async () => {
        launchIn(ElementType.PART_STUDIO);
        renderButton({ ...SHAFT, elementType: ElementType.ASSEMBLY });

        const derive = screen.getByRole("button", { name: "Derive" });
        await userEvent.click(derive);
        expect(mutate).not.toHaveBeenCalled();
        await userEvent.hover(derive);
        expect(
            await screen.findByText(
                "Assemblies can't be derived into a Part Studio."
            )
        ).toBeTruthy();
    });
});
