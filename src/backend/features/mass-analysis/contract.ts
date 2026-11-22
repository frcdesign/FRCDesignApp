/** The mass report and edits the frontend shares; a leaf, so it imports nothing of the Worker's. */
import { type ElementPath } from "../../lib/onshape/path";

/** A part, by the Part Studio the assembly references it from. */
export interface PartSource extends ElementPath {
    partId: string;
    /** As the BOM row encodes it; empty for the default. */
    configuration: string;
}

export enum MassNodeKind {
    PART = "part",
    ASSEMBLY = "assembly"
}

interface MassNodeBase {
    /** The BOM row's, unique within the report. */
    id: string;
    name: string;
    /** How many of it one of its parent holds. */
    quantity: number;
}

export interface MassPart extends MassNodeBase {
    kind: MassNodeKind.PART;
    /** Kilograms, for one; undefined when Onshape has no mass for it. */
    mass?: number;
    material?: string;
    source: PartSource;
    /** Its Part Studio is in the assembly's own workspace. */
    canSetMaterial: boolean;
    /** Its document is no library's. */
    canSetMass: boolean;
}

export interface MassAssembly extends MassNodeBase {
    kind: MassNodeKind.ASSEMBLY;
    /** A library's: its mass counts, but it isn't opened or listed. */
    isLibrary: boolean;
    children: MassNode[];
}

export type MassNode = MassPart | MassAssembly;

/** GET /api/mass-analysis: the assembly's own items, each subassembly with its own. */
export interface MassReportOut {
    children: MassNode[];
}

/** POST /api/mass-analysis/part: at least one of `material` and `mass`. */
export interface PartPropertiesIn {
    assembly: ElementPath;
    part: PartSource;
    /** A name from `MATERIALS`. */
    material?: string;
    /** Kilograms, set as the part's mass override. */
    mass?: number;
}
