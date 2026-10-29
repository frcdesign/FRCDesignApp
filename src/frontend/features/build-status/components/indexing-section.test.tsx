import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../__test_utils__/render";
import {
    boolParam,
    enumParam,
    paramsWithConfigs,
    stringParam
} from "../../../../__test_utils__/configuration-fixtures";
import type { InsertableBuildStatus } from "@backend/features/build-checker/contract";
import type { ConfigurationParameter } from "@backend/features/configurations/contract";
import { ElementType } from "@backend/lib/onshape/element-type";

const mocks = vi.hoisted(() => ({
    setIndexing: vi.fn(),
    setExcluded: vi.fn()
}));

vi.mock("../queries", () => ({
    useIndexConfigurationsMutation: () => ({
        mutate: mocks.setIndexing,
        isPending: false
    }),
    useExcludedParametersMutation: () => ({
        mutate: mocks.setExcluded,
        isPending: false
    })
}));

const { IndexingSection } = await import("./indexing-section");

function status(
    parameters: ConfigurationParameter[],
    excludedParameterIds: string[] = []
): InsertableBuildStatus {
    return {
        buildIssues: [],
        elementPath: {
            documentId: "d",
            instanceType: "v",
            instanceId: "v",
            elementId: "e"
        },
        elementType: ElementType.ASSEMBLY,
        isVisible: true,
        supportsFasten: false,
        indexConfigurations: false,
        excludedParameterIds,
        vendors: [],
        configuration: { parameters }
    };
}

describe("indexing section", () => {
    afterEach(() => {
        mocks.setIndexing.mockReset();
        mocks.setExcluded.mockReset();
    });

    it("counts the configurations its indexed parameters make", () => {
        renderWithProviders(
            <IndexingSection
                insertableId="i"
                status={status(
                    [enumParam("size", ["s", "m", "l"]), boolParam("holes")],
                    ["holes"]
                )}
            />
        );
        expect(screen.getByText("3")).toBeTruthy();
    });

    it("gives each enum and boolean a switch, and none to text", () => {
        renderWithProviders(
            <IndexingSection
                insertableId="i"
                status={status([
                    enumParam("size", ["s", "l"]),
                    boolParam("holes"),
                    stringParam("label")
                ])}
            />
        );
        expect(screen.getByText("Index size")).toBeTruthy();
        expect(screen.getByText("Index holes")).toBeTruthy();
        expect(screen.queryByText("Index label")).toBeNull();
    });

    it("stops indexing an assembly's parameter", async () => {
        renderWithProviders(
            <IndexingSection
                insertableId="i"
                status={status([enumParam("size", ["s", "l"])])}
            />
        );
        const switches = screen.getAllByRole("switch");
        await userEvent.setup().click(switches[switches.length - 1]);
        expect(mocks.setExcluded).toHaveBeenCalledWith(["size"]);
    });

    it("lets an admin enable indexing past the automatic threshold", async () => {
        renderWithProviders(
            <IndexingSection
                insertableId="i"
                status={status(paramsWithConfigs(200))}
            />
        );
        await userEvent.setup().click(screen.getAllByRole("switch")[0]);
        expect(mocks.setIndexing).toHaveBeenCalledWith(true);
    });
});
