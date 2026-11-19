import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
    type ConfigurationResult,
    type PartialSelection,
    type SearchRecord,
    ParameterRole,
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
import { QuantityType, Unit } from "@backend/features/configurations/enums";
import {
    DEFAULT_TEAM_SETTINGS,
    GenericVendorPolicy,
    type TeamSettings
} from "@backend/features/teams/contract";
import { Vendor } from "@backend/features/library/vendors";

const mocks = vi.hoisted(() => ({
    teamSettings: undefined as TeamSettings | undefined
}));

// The team's colors come from its context, which needs a router to resolve.
vi.mock("../../teams/queries", async () => {
    const { toVendorPreferences } =
        await import("@backend/features/teams/contract");
    return {
        useCurrentTeamSettings: () => mocks.teamSettings,
        useVendorPreferences: () => ({
            preferences: toVendorPreferences(mocks.teamSettings),
            isSettled: true
        })
    };
});

const { ConfigurationWrapper } = await import("./configurations");
type SelectionReport = import("./configurations").SelectionReport;

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
    // Collapsed to its value, so every surface holds one spelling of it.
    it("collapses a typed expression to its value", async () => {
        const user = userEvent.setup();
        const { lastReport } = renderPanel({
            parameters: [length],
            records: []
        });

        const input = await screen.findByLabelText("length");
        await user.clear(input);
        await user.type(input, "(2 + 3) in{Enter}");

        expect(input).toHaveProperty("value", "5 in");
        expect(lastReport().overrides).toEqual({ length: "5 in" });
        expect(lastReport().configurationKey).toBe("length=0.127%20m");

        await user.click(input);
        expect(input).toHaveProperty("value", "5 in");
    });

    it("reopens a stored expression collapsed", async () => {
        const user = userEvent.setup();
        renderPanel(
            { parameters: [length], records: [] },
            { length: "(1 + 1) in" }
        );

        const input = await screen.findByLabelText("length");
        expect(input).toHaveProperty("value", "2 in");
        await user.click(input);
        expect(input).toHaveProperty("value", "2 in");
    });

    // The box swaps its display for the full value on focus, which would drop
    // a selection made before the swap.
    it("selects the whole value when a shortened one is clicked", async () => {
        const user = userEvent.setup();
        renderPanel(
            { parameters: [length], records: [] },
            { length: "1/3 in" }
        );

        const input = await screen.findByLabelText<HTMLInputElement>("length");
        expect(input.value).toBe("0.333 in");
        await user.click(input);

        expect(input.value).toBe("0.33333333 in");
        expect(input.selectionStart).toBe(0);
        expect(input.selectionEnd).toBe("0.33333333 in".length);
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

    it("draws three color channels as one Color, offering the team's", async () => {
        const user = userEvent.setup();
        mocks.teamSettings = { ...DEFAULT_TEAM_SETTINGS, colors: ["#ff8000"] };
        const channel = (name: string) => ({
            ...quantityParam(name, {
                quantityType: QuantityType.INTEGER,
                unit: Unit.UNITLESS,
                defaultValue: 0,
                max: 255
            }),
            role: ParameterRole.COLOR_CHANNEL
        });
        const { lastReport } = renderPanel({
            parameters: [
                size,
                channel("Red"),
                channel("Green"),
                channel("Blue")
            ],
            records: []
        });

        await user.click(await screen.findByLabelText("Color"));
        await user.click(await screen.findByText("#ff8000"));

        expect(screen.queryByLabelText("Red")).toBeNull();
        expect(lastReport().selection).toMatchObject({
            Red: "255",
            Green: "128",
            Blue: "0"
        });
        mocks.teamSettings = undefined;
    });

    it("holds a Vendor list to the team's Generic policy", async () => {
        const user = userEvent.setup();
        const vendor = {
            ...enumParam("vendor", []),
            name: "Vendor",
            default: "generic",
            options: [
                { id: "generic", name: "Generic" },
                { id: "wcp", name: "West Coast Products" },
                { id: "rev", name: "REV Robotics" }
            ],
            role: ParameterRole.VENDOR
        };
        mocks.teamSettings = {
            ...DEFAULT_TEAM_SETTINGS,
            vendorRanking: [Vendor.REV],
            genericVendor: GenericVendorPolicy.BAN
        };
        const banned = renderPanel({ parameters: [vendor], records: [] });

        await user.click(await screen.findByLabelText("Vendor"));
        expect(screen.queryByRole("option", { name: "Generic" })).toBeNull();
        expect(banned.lastReport().selection).toEqual({ vendor: "rev" });
        cleanup();

        mocks.teamSettings = {
            ...DEFAULT_TEAM_SETTINGS,
            genericVendor: GenericVendorPolicy.REQUIRE
        };
        const required = renderPanel(
            { parameters: [size, vendor], records: [] },
            { vendor: "wcp" }
        );
        await screen.findByLabelText("size");
        expect(screen.queryByLabelText("Vendor")).toBeNull();
        expect(required.lastReport().selection).toMatchObject({
            vendor: "generic"
        });
        mocks.teamSettings = undefined;
    });
});
