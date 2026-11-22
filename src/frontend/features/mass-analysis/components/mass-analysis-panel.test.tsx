import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
    type MassAssembly,
    MassNodeKind,
    type MassPart,
    type MassReportOut
} from "@backend/features/mass-analysis/contract";
import { renderWithProviders } from "../../../../__test_utils__/render";
import { apiPost } from "../../../lib/api-client";
import { massReportQueryKey } from "../../../lib/query-keys";
import { POUNDS_PER_KILOGRAM } from "../mass-data";
import { MassAnalysisPanel } from "./mass-analysis-panel";

vi.mock("../../../lib/api-client", () => ({
    apiGet: vi.fn(),
    apiPost: vi.fn(() => Promise.resolve({}))
}));

// Signed out, so the report query only reads what a test seeds
vi.mock("../../auth/access-level", () => ({ useIsSignedIn: () => false }));

const ASSEMBLY = {
    documentId: "robot",
    instanceType: "w" as const,
    instanceId: "main",
    elementId: "top"
};

function part(name: string, overrides: Partial<MassPart> = {}): MassPart {
    return {
        kind: MassNodeKind.PART,
        id: name,
        name,
        quantity: 1,
        source: {
            ...ASSEMBLY,
            elementId: `${name}-studio`,
            partId: "JHD",
            configuration: ""
        },
        canSetMaterial: true,
        canSetMass: true,
        ...overrides
    };
}

const DRIVETRAIN: MassAssembly = {
    kind: MassNodeKind.ASSEMBLY,
    id: "drivetrain",
    name: "Drivetrain",
    quantity: 1,
    isLibrary: false,
    children: [
        part("Rail", { mass: 1, quantity: 2 }),
        part("Bracket", {
            quantity: 4,
            canSetMaterial: false,
            source: {
                documentId: "elsewhere",
                instanceType: "v",
                instanceId: "v1",
                elementId: "bracket-studio",
                partId: "JFD",
                configuration: ""
            }
        })
    ]
};

const REPORT: MassReportOut = {
    children: [
        DRIVETRAIN,
        part("Plate"),
        part("Library spacer", { canSetMaterial: false, canSetMass: false })
    ]
};

function renderPanel() {
    const rendered = renderWithProviders(
        <MassAnalysisPanel assembly={ASSEMBLY} />
    );
    rendered.queryClient.setQueryData(massReportQueryKey(ASSEMBLY), REPORT);
    return rendered;
}

/** The card a part's name heads. */
async function card(name: string): Promise<HTMLElement> {
    const heading = await screen.findByText(name);
    const found = heading.closest<HTMLElement>(".mantine-Card-root");
    if (!found) throw new Error(`No card for ${name}`);
    return found;
}

afterEach(() => {
    vi.clearAllMocks();
});

describe("MassAnalysisPanel", () => {
    it("lists each part with no mass, with how many there are and where", async () => {
        renderPanel();

        const bracket = await card("Bracket");
        expect(within(bracket).getByText("×4")).toBeTruthy();
        expect(within(bracket).getByText("In Drivetrain")).toBeTruthy();
        expect(screen.queryByText("Rail")).toBeNull();
        expect(screen.getByText("3 parts")).toBeTruthy();
    });

    it("keeps another document's material from being set", async () => {
        renderPanel();

        const bracket = await card("Bracket");
        expect(
            within(bracket).getByRole("combobox", { name: "Material" })
        ).toHaveProperty("disabled", true);
        expect(
            within(bracket).getByText("Set in the part's own document")
        ).toBeTruthy();
    });

    it("offers nothing to set on a library's part", async () => {
        renderPanel();

        const spacer = await card("Library spacer");
        expect(within(spacer).getByText("Library part")).toBeTruthy();
        expect(within(spacer).queryByRole("button")).toBeNull();
    });

    it("saves a mass in pounds as kilograms", async () => {
        renderPanel();

        const plate = await card("Plate");
        const save = within(plate).getByRole("button", { name: "Save" });
        expect(save).toHaveProperty("disabled", true);
        await userEvent.type(within(plate).getByLabelText("Mass (lb)"), "2");
        await userEvent.click(save);

        await waitFor(() => expect(apiPost).toHaveBeenCalled());
        const [path, options] = vi.mocked(apiPost).mock.calls[0];
        expect(path).toBe("/mass-analysis/part");
        expect(options?.body).toMatchObject({
            assembly: ASSEMBLY,
            part: { elementId: "Plate-studio", partId: "JHD" }
        });
        expect(
            (options?.body as { mass: number }).mass * POUNDS_PER_KILOGRAM
        ).toBeCloseTo(2);
    });
});
