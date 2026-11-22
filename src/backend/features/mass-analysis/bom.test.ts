import { describe, expect, it } from "vitest";
import type { OnshapeBom, OnshapeBomRow } from "../../lib/onshape/types";
import { type BomContext, parseMass, toMassReport } from "./bom";
import { type MassAssembly, MassNodeKind, type MassPart } from "./contract";

const ASSEMBLY = {
    documentId: "robot",
    instanceType: "w",
    instanceId: "main",
    elementId: "top"
} as const;

const CONTEXT: BomContext = {
    assembly: ASSEMBLY,
    libraryDocumentIds: new Set(["library"])
};

const HEADERS = [
    { id: "h-name", name: "Name", propertyName: "name" },
    { id: "h-qty", name: "Quantity", propertyName: "quantity" },
    { id: "h-mass", name: "Mass", propertyName: "mass" },
    { id: "h-override", name: "Mass override" },
    { id: "h-material", name: "Material", propertyName: "material" }
];

interface RowOptions {
    depth?: number;
    quantity?: number;
    mass?: unknown;
    material?: unknown;
    documentId?: string;
    wvmType?: string;
    partId?: string;
}

function row(name: string, options: RowOptions = {}): OnshapeBomRow {
    const documentId = options.documentId ?? ASSEMBLY.documentId;
    return {
        rowId: name,
        indentLevel: options.depth ?? 0,
        itemSource: {
            documentId,
            wvmType:
                options.wvmType ??
                (documentId === ASSEMBLY.documentId ? "w" : "v"),
            wvmId: "instance",
            elementId: `${name}-studio`,
            partId: "partId" in options ? options.partId : `${name}-part`,
            configuration: ""
        },
        headerIdToValue: {
            "h-name": name,
            "h-qty": options.quantity ?? 1,
            "h-mass": options.mass,
            "h-override": "5 lb",
            "h-material": options.material
        }
    };
}

function report(rows: OnshapeBomRow[]) {
    const bom: OnshapeBom = { headers: HEADERS, rows };
    return toMassReport(bom, CONTEXT);
}

describe("parseMass", () => {
    it.each([
        [2, 2],
        ["2", 2],
        ["2 kg", 2],
        ["500 g", 0.5],
        ["1 lb", 0.45359237],
        ["16 oz", 0.45359237],
        [{ value: 3, unit: "kg" }, 3],
        [{ value: "1 lb" }, 0.45359237]
    ])("reads %j", (value, kilograms) => {
        expect(parseMass(value)).toBeCloseTo(kilograms);
    });

    it.each([undefined, null, "", "No value", 0, "0 kg", "2 furlongs", {}])(
        "has no mass for %j",
        (value) => {
            expect(parseMass(value)).toBeUndefined();
        }
    );
});

describe("toMassReport", () => {
    it("nests a subassembly's rows under it", () => {
        const out = report([
            row("Drivetrain", { quantity: 1, partId: undefined }),
            row("Rail", { depth: 1, quantity: 2, mass: "1 kg" }),
            row("Gearbox", { depth: 1, partId: undefined }),
            row("Gear", { depth: 2, quantity: 3, mass: "0.1 kg" }),
            row("Bumper", { mass: "4 kg" })
        ]);

        expect(out.children.map((node) => node.name)).toEqual([
            "Drivetrain",
            "Bumper"
        ]);
        const drivetrain = out.children[0] as MassAssembly;
        expect(drivetrain.kind).toBe(MassNodeKind.ASSEMBLY);
        expect(drivetrain.children.map((node) => node.name)).toEqual([
            "Rail",
            "Gearbox"
        ]);
        const gearbox = drivetrain.children[1] as MassAssembly;
        expect(gearbox.children).toMatchObject([
            { name: "Gear", quantity: 3, mass: 0.1 }
        ]);
    });

    it("reads a row with deeper rows after it as a subassembly", () => {
        const out = report([
            row("Arm", { partId: "looks-like-a-part" }),
            row("Tube", { depth: 1, mass: "1 kg" })
        ]);

        expect(out.children[0].kind).toBe(MassNodeKind.ASSEMBLY);
    });

    it("reads the mass column, not the mass override's", () => {
        const [part] = report([row("Plate")]).children as MassPart[];

        expect(part.mass).toBeUndefined();
    });

    it("reads a material by its display name", () => {
        const [part] = report([
            row("Plate", {
                mass: "1 kg",
                material: { displayName: "Aluminum - 6061" }
            })
        ]).children as MassPart[];

        expect(part.material).toBe("Aluminum - 6061");
    });

    it("lets only a part in the assembly's own workspace have its material set", () => {
        const [own, other] = report([
            row("Own"),
            row("Other", { documentId: "elsewhere" })
        ]).children as MassPart[];

        expect(own).toMatchObject({ canSetMaterial: true, canSetMass: true });
        expect(other).toMatchObject({
            canSetMaterial: false,
            canSetMass: true
        });
        expect(other.source).toMatchObject({
            documentId: "elsewhere",
            instanceType: "v"
        });
    });

    it("lets nothing of a library's be set, inside its assemblies too", () => {
        const out = report([
            row("Library part", { documentId: "library" }),
            row("Library gearbox", {
                documentId: "library",
                partId: undefined
            }),
            row("Its screw", { depth: 1, documentId: "elsewhere" })
        ]);
        const [part, gearbox] = out.children as [MassPart, MassAssembly];

        expect(part.canSetMass).toBe(false);
        expect(gearbox.isLibrary).toBe(true);
        expect(gearbox.children[0]).toMatchObject({ canSetMass: false });
    });

    it("marks an assembly inside a library's as a library's", () => {
        const out = report([
            row("Library gearbox", {
                documentId: "library",
                partId: undefined
            }),
            row("Its stage", {
                depth: 1,
                documentId: "elsewhere",
                partId: undefined
            }),
            row("Its gear", { depth: 2, documentId: "elsewhere" })
        ]);
        const gearbox = out.children[0] as MassAssembly;

        expect(gearbox.children[0]).toMatchObject({ isLibrary: true });
    });

    it("leaves out a row added by hand", () => {
        const handAdded = row("Glue");
        handAdded.itemSource = { nonGeometricItemId: "glue" };

        expect(report([handAdded, row("Plate")]).children).toHaveLength(1);
    });

    it("counts a row with no quantity once", () => {
        const plate = row("Plate");
        delete plate.headerIdToValue?.["h-qty"];

        expect(report([plate]).children[0].quantity).toBe(1);
    });
});
