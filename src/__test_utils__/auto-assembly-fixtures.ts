/** A stubbed assembly for Auto Assembly's worker tests: two 1/4 in. plates, each in its own Part Studio. */
import { vi } from "vitest";
import * as Assemblies from "@backend/lib/onshape/endpoints/assemblies";
import * as Documents from "@backend/lib/onshape/endpoints/documents";
import * as PartStudios from "@backend/lib/onshape/endpoints/part-studios";
import { toTranslation } from "@backend/lib/onshape/objects/transform";
import {
    type OnshapeAssemblyDefinition,
    type OnshapeFeatureScriptValue
} from "@backend/lib/onshape/types";
import { Program } from "@backend/features/auto-assembly/catalog";
import {
    DEFAULT_MAX_THREAD_DEPTH,
    FastenerMode,
    type AutoAssemblyIn,
    SelectedEntityType,
    SelectionMode,
    StopCondition
} from "@backend/features/auto-assembly/contract";

export const INCH = 0.0254;

export const ASSEMBLY = {
    documentId: "doc",
    instanceId: "ws",
    instanceType: "w" as const,
    elementId: "asm"
};

/** Two 1/4 in. plates stacked down from the origin, each in its own Part Studio. */
export const DEFINITION: OnshapeAssemblyDefinition = {
    rootAssembly: {
        features: [],
        instances: [
            {
                id: "top",
                type: "Part",
                documentId: "doc",
                elementId: "topStudio",
                partId: "TOP"
            },
            {
                id: "bottom",
                type: "Part",
                documentId: "doc",
                elementId: "bottomStudio",
                partId: "BOTTOM"
            }
        ],
        occurrences: [
            { path: ["top"], transform: toTranslation([0, 0, 0]) },
            { path: ["bottom"], transform: toTranslation([0, 0, -0.25 * INCH]) }
        ]
    },
    parts: [],
    subAssemblies: []
};

// FeatureScript values, as the evaluation answers them
export const fs = {
    number: (value: number) => ({ btType: "BTFSValueNumber-772", value }),
    string: (value: string) => ({ btType: "BTFSValueString-1422", value }),
    boolean: (value: boolean) => ({ btType: "BTFSValueBoolean-1195", value }),
    array: (values: OnshapeFeatureScriptValue[]) => ({
        btType: "BTFSValueArray-1499",
        value: values
    }),
    vector: (values: number[]) => fs.array(values.map(fs.number)),
    map: (entries: Record<string, OnshapeFeatureScriptValue>) => ({
        btType: "BTFSValueMap-2062",
        value: Object.entries(entries).map(([key, value]) => ({
            key: fs.string(key),
            value
        }))
    })
};

/** A plate's 0.201 in. hole, down from its top at its origin. */
export function plateScan(partId: string, edges: string[] = []) {
    const hole = fs.map({
        faceId: fs.string(`${partId}-face`),
        origin: fs.vector([0, 0, 0]),
        direction: fs.vector([0, 0, -1]),
        radius: fs.number((0.201 * INCH) / 2),
        start: fs.number(0),
        end: fs.number(0.25 * INCH),
        closedAtStart: fs.boolean(false),
        closedAtEnd: fs.boolean(false),
        threaded: fs.boolean(false),
        edges: fs.array([
            fs.map({ id: fs.string(`${partId}-top`), at: fs.number(0) }),
            fs.map({
                id: fs.string(`${partId}-bottom`),
                at: fs.number(0.25 * INCH)
            })
        ])
    });
    const circles = edges.map((id) =>
        fs.map({
            id: fs.string(id),
            partId: fs.string(partId),
            center: fs.vector([0, 0, 0]),
            radius: fs.number((0.201 * INCH) / 2),
            normal: fs.vector([0, 0, 1])
        })
    );
    return fs.map({
        parts: fs.map({ [partId]: fs.map({ holes: fs.array([hole]) }) }),
        circles: fs.array(circles)
    });
}

/** The microversion each tab of `ASSEMBLY`'s workspace last changed in. */
export interface TabMicroversions {
    assembly: string;
    top: string;
    bottom: string;
    /** A tab nothing in the assembly references. */
    drawing: string;
}

const FIRST_EDITS: TabMicroversions = {
    assembly: "a1",
    top: "t1",
    bottom: "b1",
    drawing: "d1"
};

/** `ASSEMBLY`'s workspace's tabs, each at its microversion. */
export function workspaceElements(edits: Partial<TabMicroversions> = {}) {
    const at = { ...FIRST_EDITS, ...edits };
    return [
        {
            id: ASSEMBLY.elementId,
            name: "Assembly",
            elementType: "ASSEMBLY",
            microversionId: at.assembly
        },
        {
            id: "topStudio",
            name: "Top",
            elementType: "PARTSTUDIO",
            microversionId: at.top
        },
        {
            id: "bottomStudio",
            name: "Bottom",
            elementType: "PARTSTUDIO",
            microversionId: at.bottom
        },
        {
            id: "drawing",
            name: "Drawing",
            elementType: "DRAWING",
            microversionId: at.drawing
        }
    ] as Awaited<ReturnType<typeof Documents.getElements>>;
}

/** Picked edges a plate's scan gives a circle for. */
const PLATE_EDGES = ["TOP-top", "BOTTOM-top"];

/**
 * Onshape's answers to reading `ASSEMBLY`'s workspace: its tabs, its
 * definition, and each studio's scan, which gives a circle for each plate edge
 * it is asked about.
 */
export function mockAssemblyReads() {
    return {
        elements: vi
            .spyOn(Documents, "getElements")
            .mockResolvedValue(workspaceElements()),
        assembly: vi
            .spyOn(Assemblies, "getAssembly")
            .mockResolvedValue(DEFINITION),
        scan: vi
            .spyOn(PartStudios, "evaluateFeatureScript")
            .mockImplementation((_client, path, script) => {
                const partId =
                    path.elementId === "topStudio" ? "TOP" : "BOTTOM";
                const edges = PLATE_EDGES.filter(
                    (id) =>
                        id.startsWith(partId) &&
                        script.includes(`qTransient(${JSON.stringify(id)})`)
                );
                return Promise.resolve({ result: plateScan(partId, edges) });
            })
    };
}

/** Fasten the top plate's top edge, with a nylock. */
export const BODY: AutoAssemblyIn = {
    assembly: ASSEMBLY,
    selectionMode: SelectionMode.LOCATIONS,
    excluded: [],
    replaced: [],
    targets: [
        {
            occurrencePath: ["top"],
            entityId: "TOP-top",
            entityType: SelectedEntityType.EDGE
        }
    ],
    options: {
        program: Program.FRC,
        mode: FastenerMode.AUTOMATIC,
        screw: {
            vendor: "GENERIC",
            size: "NO_10_32",
            head: "BUTTON",
            finish: "BLACK",
            length: "IN_0_5",
            fullyThreaded: "false"
        },
        nut: { vendor: "MCMASTER", size: "NO_10_32", type: "NYLOCK" },
        stop: StopCondition.ALL_HOLES,
        maxThreadDepth: DEFAULT_MAX_THREAD_DEPTH
    }
};
