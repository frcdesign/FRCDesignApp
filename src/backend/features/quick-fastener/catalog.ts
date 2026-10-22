/**
 * Quick fastener's parts, as robot-code's `fastenerTables.py` defines them
 * (synced into `catalog.gen.ts`): what the planner sizes them by. The Part
 * Studios they're inserted from are in `studios.ts`. Lengths are metres.
 */
import { CATALOG } from "./catalog.gen";

/** FTC's fasteners aren't in the catalog yet. */
export enum Program {
    FRC = "frc",
    FTC = "ftc"
}

/** What every catalog part carries, where its vendor has them. */
interface Stocked {
    partNumber?: string;
    url?: string;
}

export interface CatalogVendor {
    id: string;
    name: string;
}

export interface CatalogSize {
    id: string;
    name: string;
    majorDiameter: number;
    pitch: number;
    tapDrillDiameter: number;
    closeClearanceDiameter: number;
    freeClearanceDiameter: number;
}

export interface CatalogHead {
    id: string;
    name: string;
    sizes: Record<
        string,
        { diameter: number; height: number; countersunk: boolean }
    >;
}

export interface CatalogLength {
    id: string;
    name: string;
    length: number;
    /** Whether it's sold fully threaded as well as partly, so the studio asks which. */
    fullThreadChoice: boolean;
}

/** The lengths a vendor makes a size and head in, in a finish, shortest first. */
export interface CatalogScrew {
    vendor: string;
    size: string;
    head: string;
    finish: string;
    lengths: CatalogLength[];
}

export interface CatalogNut extends Stocked {
    vendor: string;
    size: string;
    type: string;
    acrossFlats: number;
    height: number;
}

export interface CatalogWasher {
    vendor: string;
    size: string;
    type: string;
    name: string;
    innerDiameter: number;
    outerDiameter: number;
    thickness: number;
    /** The finishes it's made in, which don't change its size. */
    finishes: string[];
}

export interface Catalog {
    vendors: CatalogVendor[];
    sizes: CatalogSize[];
    heads: CatalogHead[];
    screws: CatalogScrew[];
    nutTypes: { id: string; name: string }[];
    nuts: CatalogNut[];
    washers: CatalogWasher[];
}

export const catalog: Catalog = CATALOG;

export function getCatalog(program: Program): Catalog | undefined {
    return program === Program.FRC ? catalog : undefined;
}

export function getSize(sizeId: string): CatalogSize | undefined {
    return catalog.sizes.find((size) => size.id === sizeId);
}

export function getHead(headId: string): CatalogHead | undefined {
    return catalog.heads.find((head) => head.id === headId);
}

/** The lengths a vendor makes a size and head in, in a finish; none when it doesn't make them. */
export function getLengths(
    vendor: string,
    size: string,
    head: string,
    finish: string
): CatalogLength[] {
    return (
        catalog.screws.find(
            (screw) =>
                screw.vendor === vendor &&
                screw.size === size &&
                screw.head === head &&
                screw.finish === finish
        )?.lengths ?? []
    );
}

export function getNut(
    vendor: string,
    size: string,
    type: string
): CatalogNut | undefined {
    return catalog.nuts.find(
        (nut) => nut.vendor === vendor && nut.size === size && nut.type === type
    );
}

export function getWasher(
    vendor: string,
    size: string,
    type: string
): CatalogWasher | undefined {
    return catalog.washers.find(
        (washer) =>
            washer.vendor === vendor &&
            washer.size === size &&
            washer.type === type
    );
}
