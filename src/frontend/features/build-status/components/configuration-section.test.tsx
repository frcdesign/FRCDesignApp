import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../__test_utils__/render";
import {
    boolParam,
    derivationParam,
    enumParam,
    paramsWithConfigs,
    stringParam
} from "../../../../__test_utils__/configuration-fixtures";
import type { InsertableBuildStatus } from "@backend/features/build-checker/contract";
import type { ConfigurationParameter } from "@backend/features/configurations/contract";
import { ElementType } from "@backend/lib/onshape/element-type";
import { AUTO_INDEX_THRESHOLD } from "@backend/features/configurations/combinations";

const mocks = vi.hoisted(() => ({ applyIndexing: vi.fn() }));

vi.mock("../queries", () => ({
    useIndexingMutation: () => ({
        mutate: mocks.applyIndexing,
        isPending: false
    })
}));

const { ConfigurationSection } = await import("./configuration-section");
const { clearIndexingDraft } = await import("../indexing-draft");
const { updateUiState } = await import("../../../lib/ui-state");

let nextId = 0;

function statusOf(
    parameters: ConfigurationParameter[],
    stored: Partial<InsertableBuildStatus> = {}
): InsertableBuildStatus {
    return {
        buildIssues: [],
        elementPath: {
            documentId: "d",
            instanceType: "v",
            instanceId: "v",
            elementId: "e"
        },
        elementType: ElementType.PART_STUDIO,
        isVisible: true,
        supportsFasten: false,
        hasMateConnector: false,
        indexConfigurations: false,
        excludedParameterIds: [],
        vendors: [],
        configuration: { parameters },
        ...stored
    };
}

/** A fresh id unless given one, since drafts outlive a render. */
function renderSection(
    parameters: ConfigurationParameter[],
    insertableId = `i${nextId++}`
) {
    const view = renderWithProviders(
        <ConfigurationSection
            insertableId={insertableId}
            status={statusOf(parameters)}
            parameters={parameters}
        />
    );
    return { ...view, insertableId };
}

/** Rendered and opened, as an editor would find it; it starts closed. */
async function renderOpen(parameters: ConfigurationParameter[]) {
    const view = renderSection(parameters);
    await userEvent.click(screen.getByText("Configuration"));
    // The fold opens over a transition.
    await screen.findByRole("table");
    return view;
}

/** The row holding a parameter's name. */
function row(name: string): HTMLElement {
    const element = screen.getByText(name).closest("tr");
    if (!element) throw new Error(`No row for ${name}`);
    return element;
}

function saveButton(): HTMLButtonElement {
    return screen.getByRole("button", { name: "Save" });
}

function checkbox(name: string): HTMLInputElement {
    return within(row(name)).getByRole("checkbox");
}

describe("configuration section", () => {
    afterEach(() => {
        mocks.applyIndexing.mockReset();
        for (let id = 0; id < nextId; id++) clearIndexingDraft(`i${id}`);
        updateUiState({ cardSections: {} });
    });

    it("starts closed, counting its parameters", () => {
        renderSection([enumParam("size", ["s", "l"]), boolParam("holes")]);
        expect(screen.getByText("2 parameters")).toBeTruthy();
        expect(screen.queryByText("size")).toBeNull();
    });

    it("lists every parameter once, with its type", async () => {
        await renderOpen([
            enumParam("size", ["s", "m", "l"]),
            boolParam("holes"),
            stringParam("label")
        ]);
        expect(screen.getByText("Enum · 3")).toBeTruthy();
        expect(screen.getByText("Boolean")).toBeTruthy();
        expect(screen.getByText("Text")).toBeTruthy();
    });

    it("lets enums and booleans be indexed, but not text or a role", async () => {
        await renderOpen([
            enumParam("size", ["s", "l"]),
            boolParam("holes"),
            stringParam("label"),
            derivationParam("derive")
        ]);
        expect(checkbox("size").disabled).toBe(false);
        expect(checkbox("holes").disabled).toBe(false);
        expect(checkbox("label").disabled).toBe(true);
        expect(checkbox("Derivation Variable").disabled).toBe(true);
    });

    it("recounts as parameters are unchecked, before anything is applied", async () => {
        await renderOpen([
            enumParam("size", ["s", "m", "l"]),
            boolParam("holes")
        ]);
        expect(screen.getByText(/^6 configurations/)).toBeTruthy();

        await userEvent.click(checkbox("holes"));

        expect(screen.getByText(/^3 configurations/)).toBeTruthy();
        expect(mocks.applyIndexing).not.toHaveBeenCalled();
    });

    it("applies every edit in one reindex", async () => {
        await renderOpen([
            enumParam("size", ["s", "l"]),
            enumParam("finish", ["matte", "gloss"]),
            boolParam("holes")
        ]);

        await userEvent.click(checkbox("finish"));
        await userEvent.click(checkbox("holes"));
        expect(screen.getByText("2 unsaved")).toBeTruthy();

        await userEvent.click(saveButton());

        expect(mocks.applyIndexing).toHaveBeenCalledOnce();
        expect(mocks.applyIndexing).toHaveBeenCalledWith({
            excludedParameterIds: ["finish", "holes"]
        });
    });

    it("has nothing to save once an edit is undone", async () => {
        await renderOpen([enumParam("size", ["s", "l"]), boolParam("holes")]);
        expect(saveButton().disabled).toBe(true);

        await userEvent.click(checkbox("holes"));
        expect(screen.getByText("1 unsaved")).toBeTruthy();
        expect(saveButton().disabled).toBe(false);
        await userEvent.click(checkbox("holes"));

        expect(screen.queryByText("1 unsaved")).toBeNull();
        expect(saveButton().disabled).toBe(true);
    });

    it("offers the switch only once there are too many to index automatically", async () => {
        await renderOpen(paramsWithConfigs(AUTO_INDEX_THRESHOLD + 1));

        await userEvent.click(screen.getByRole("switch"));
        await userEvent.click(saveButton());

        expect(mocks.applyIndexing).toHaveBeenCalledWith({
            indexConfigurations: true
        });
    });

    it("keeps a draft when the card closes and opens again", async () => {
        const { unmount, insertableId } = await renderOpen([
            enumParam("size", ["s", "l"]),
            boolParam("holes")
        ]);
        await userEvent.click(checkbox("holes"));
        unmount();

        // Opened stays opened, since the card remembers it.
        renderSection(
            [enumParam("size", ["s", "l"]), boolParam("holes")],
            insertableId
        );

        expect(screen.getByText("1 unsaved")).toBeTruthy();
        expect(checkbox("holes").checked).toBe(false);
    });
});
