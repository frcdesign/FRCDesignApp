import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
    type MassAssembly,
    MassNodeKind,
    type MassPart,
    type MassReportOut
} from "@backend/features/mass-analysis/contract";
import { renderWithProviders } from "../../../../__test_utils__/render";
import { useOnshapeLaunch } from "../../../lib/onshape-params";
import { massReportQueryKey } from "../../../lib/query-keys";
import { MassAnalysisPanel } from "./mass-analysis-panel";

vi.mock("../../../lib/api-client", () => ({ apiGet: vi.fn() }));

// Signed out, so the report query only reads what a test seeds
vi.mock("../../auth/access-level", () => ({ useIsSignedIn: () => false }));

const ASSEMBLY = {
    documentId: "robot",
    instanceType: "w" as const,
    instanceId: "main",
    elementId: "top"
};

function part(
    name: string,
    occurrences: string[][],
    overrides: Partial<MassPart> = {}
): MassPart {
    return {
        kind: MassNodeKind.PART,
        id: `${name}-${occurrences.join(",")}`,
        name,
        quantity: 1,
        partKey: `${name}-studio`,
        occurrences,
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
        part("Rail", [["D", "R"]], { mass: 1, quantity: 2 }),
        part("Bracket", [["D", "B1"]], { quantity: 4 })
    ]
};

const REPORT: MassReportOut = {
    children: [
        DRIVETRAIN,
        part("Bracket", [["B2"]]),
        part("Plate", [["P"]]),
        {
            kind: MassNodeKind.ASSEMBLY,
            id: "gearbox",
            name: "Library gearbox",
            quantity: 1,
            isLibrary: true,
            children: [part("Gear", [["G", "1"]])]
        }
    ]
};

function renderPanel() {
    const rendered = renderWithProviders(
        <MassAnalysisPanel assembly={ASSEMBLY} />
    );
    rendered.queryClient.setQueryData(massReportQueryKey(ASSEMBLY), REPORT);
    return rendered;
}

/** The row a part's name heads. */
async function row(name: string): Promise<HTMLElement> {
    const label = await screen.findByText(name);
    const found = label.parentElement?.parentElement;
    if (!found) throw new Error(`No row for ${name}`);
    return found;
}

beforeEach(() => {
    useOnshapeLaunch.setState({
        ...ASSEMBLY,
        elementType: "ASSEMBLY" as never
    });
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("MassAnalysisPanel", () => {
    it("lists each part with no mass once, with how many there are and where", async () => {
        renderPanel();

        const bracket = await row("Bracket");
        expect(within(bracket).getByText("×5")).toBeTruthy();
        expect(within(bracket).getByText("Drivetrain")).toBeTruthy();
        expect(screen.getAllByText("Bracket")).toHaveLength(1);
        expect(screen.queryByText("Rail")).toBeNull();
        expect(screen.getByText("2 parts")).toBeTruthy();
    });

    it("leaves out the parts of a library's assembly", async () => {
        renderPanel();

        await row("Plate");
        expect(screen.queryByText("Gear")).toBeNull();
    });

    it("lights up every instance of a hovered part in Onshape", async () => {
        const posted = vi
            .spyOn(window.parent, "postMessage")
            .mockImplementation(vi.fn());
        renderPanel();

        await userEvent.hover(await row("Bracket"));

        expect(posted).toHaveBeenCalledWith(
            expect.objectContaining({
                messageName: "requestSelectionHighlight",
                selections: [
                    {
                        selectionType: "OCCURRENCE",
                        occurrencePath: ["D", "B1"]
                    },
                    { selectionType: "OCCURRENCE", occurrencePath: ["B2"] }
                ]
            }),
            "*"
        );
    });
});
