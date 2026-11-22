/** The mass report the frontend shares; a leaf, so it imports nothing of the Worker's. */

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
    /** The same Part Studio, part and configuration wherever it's placed. */
    partKey: string;
    /** Each instance of it, as a path of instance ids from the assembly down. */
    occurrences: string[][];
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
