/** A stubbed assembly for Auto Assembly's worker tests: two 1/4 in. plates, each in its own Part Studio. */
import { toTranslation } from "@backend/lib/onshape/objects/transform";
import {
    type OnshapeAssemblyDefinition,
    type OnshapeFeatureScriptValue
} from "@backend/lib/onshape/types";
import { Program } from "@backend/features/auto-assembly/catalog";
import {
    DEFAULT_MAX_GAP,
    DEFAULT_MAX_LENGTH,
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

/** Fasten the top plate's top edge, with a nylock. */
export const BODY: AutoAssemblyIn = {
    assembly: ASSEMBLY,
    selectionMode: SelectionMode.LOCATIONS,
    excluded: [],
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
        stop: StopCondition.MAX_LENGTH,
        maxLength: DEFAULT_MAX_LENGTH,
        maxGap: DEFAULT_MAX_GAP,
        maxThreadDepth: DEFAULT_MAX_THREAD_DEPTH
    }
};
