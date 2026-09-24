import { useState } from "react";
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
    type ConfigurationResult,
    type PartialSelection,
    type SearchRecord,
    VisibilityType
} from "@backend/features/configurations/contract";
import {
    boolParam,
    enumParam,
    quantityParam,
    derivationParam
} from "../../../../__test_utils__/configuration-fixtures";
import {
    createTestQueryClient,
    renderWithProviders
} from "../../../../__test_utils__/render";
import { configurationQueryKey } from "../../../lib/query-keys";
import { ConfigurationWrapper, type SelectionReport } from "./configurations";

const size = enumParam("size", ["small", "large"]);
const length = quantityParam("length");
const reinforced = {
    ...boolParam("reinforced"),
    condition: {
        type: VisibilityType.EQUAL as const,
        id: "size",
        value: "large"
    }
};

function record(values: Record<string, string>, partNumber: string) {
    return { values, partNumber, configurationKey: "" } satisfies SearchRecord;
}

interface HostProps {
    initial: PartialSelection;
    onReport: (report: SelectionReport) => void;
}

/** Holds the panel's selection the way the insert menu does. */
function Host(props: HostProps) {
    const [selection, setSelection] = useState(props.initial);
    return (
        <ConfigurationWrapper
            insertableId="i1"
            microversionId="mv1"
            selection={selection}
            setSelection={setSelection}
            onReport={props.onReport}
        />
    );
}

/** Mounts the panel over seeded parameters, collecting what it reports. */
function renderPanel(
    result: ConfigurationResult,
    initial: PartialSelection = {}
) {
    const reports: SelectionReport[] = [];
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(configurationQueryKey("i1", "mv1"), result);
    renderWithProviders(
        <Host initial={initial} onReport={(report) => reports.push(report)} />,
        queryClient
    );
    return { lastReport: () => reports[reports.length - 1] };
}

describe("ConfigurationWrapper", () => {
    // Onshape is sent what was typed; the key is canonical, for the thumbnail.
    it("keeps a typed expression, and shows what it evaluates to", async () => {
        const user = userEvent.setup();
        const { lastReport } = renderPanel({
            parameters: [length],
            records: []
        });

        const input = await screen.findByLabelText("length");
        await user.clear(input);
        await user.type(input, "(2 + 3) in{Enter}");

        expect(input).toHaveProperty("value", "5 in");
        expect(lastReport().overrides).toEqual({ length: "(2 + 3) in" });
        expect(lastReport().configurationKey).toBe("length=0.127%20m");

        await user.click(input);
        expect(input).toHaveProperty("value", "(2 + 3) in");
    });

    it("reopens a stored expression as it was typed", async () => {
        const user = userEvent.setup();
        renderPanel(
            { parameters: [length], records: [] },
            { length: "(1 + 1) in" }
        );

        const input = await screen.findByLabelText("length");
        expect(input).toHaveProperty("value", "2 in");
        await user.click(input);
        expect(input).toHaveProperty("value", "(1 + 1) in");
    });

    it("keeps a bad expression out of the selection, and says why", async () => {
        const user = userEvent.setup();
        const { lastReport } = renderPanel({
            parameters: [length],
            records: []
        });

        const input = await screen.findByLabelText("length");
        await user.clear(input);
        await user.type(input, "2 deg{Enter}");

        expect(await screen.findByText("Expected a length")).toBeTruthy();
        expect(lastReport().overrides).toEqual({});
    });

    it("shows a parameter only while its condition holds", async () => {
        const user = userEvent.setup();
        const { lastReport } = renderPanel({
            parameters: [size, reinforced],
            records: []
        });

        await screen.findByLabelText("size");
        expect(screen.queryByLabelText("reinforced")).toBeNull();

        await user.click(screen.getByLabelText("size"));
        await user.click(await screen.findByRole("option", { name: "large" }));

        expect(await screen.findByLabelText("reinforced")).toBeTruthy();
        expect(lastReport().overrides).toEqual({ size: "large" });
    });

    // The header names the part on screen, so it follows the selection.
    it("reports the record the selection produces", async () => {
        const user = userEvent.setup();
        const { lastReport } = renderPanel({
            parameters: [size],
            records: [
                record({}, "PN-SMALL"),
                record({ size: "large" }, "PN-LARGE")
            ]
        });

        await screen.findByLabelText("size");
        expect(lastReport().record?.partNumber).toBe("PN-SMALL");

        await user.click(screen.getByLabelText("size"));
        await user.click(await screen.findByRole("option", { name: "large" }));

        expect(lastReport().record?.partNumber).toBe("PN-LARGE");
    });

    it("fills a derivation variable itself and keeps it read-only", async () => {
        const { lastReport } = renderPanel({
            parameters: [derivationParam("dv"), size],
            records: []
        });

        const input = await screen.findByLabelText("Derivation Variable");
        expect(input).toHaveProperty("readOnly", true);
        expect((input as HTMLInputElement).value).toMatch(/^[0-9a-f-]{36}$/);
        expect(lastReport().overrides).toEqual({});
    });
});
