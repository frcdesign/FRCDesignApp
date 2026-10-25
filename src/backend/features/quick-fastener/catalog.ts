/**
 * Quick fastener's parts, as robot-code's `fastenerTables.py` defines them and
 * a library loads them from the manifest released beside the studios: what the
 * planner sizes them by. The Part Studios they're inserted from are in
 * `studios.ts`. Lengths are metres.
 */
import { z } from "zod";

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

const named = z.object({ id: z.string(), name: z.string() });
const stocked = {
    partNumber: z.string().optional(),
    url: z.string().optional()
};

/** A released manifest's catalog, which a load stores beside the set's studios. */
export const catalogSchema = z.object({
    vendors: z.array(named),
    sizes: z.array(
        named.extend({
            majorDiameter: z.number(),
            pitch: z.number(),
            tapDrillDiameter: z.number(),
            closeClearanceDiameter: z.number(),
            freeClearanceDiameter: z.number()
        })
    ),
    heads: z.array(
        named.extend({
            sizes: z.record(
                z.string(),
                z.object({
                    diameter: z.number(),
                    height: z.number(),
                    countersunk: z.boolean()
                })
            )
        })
    ),
    screws: z.array(
        z.object({
            vendor: z.string(),
            size: z.string(),
            head: z.string(),
            finish: z.string(),
            lengths: z.array(
                named.extend({
                    length: z.number(),
                    fullThreadChoice: z.boolean()
                })
            )
        })
    ),
    nutTypes: z.array(named),
    nuts: z.array(
        z.object({
            vendor: z.string(),
            size: z.string(),
            type: z.string(),
            acrossFlats: z.number(),
            height: z.number(),
            ...stocked
        })
    ),
    washers: z.array(
        z.object({
            vendor: z.string(),
            size: z.string(),
            type: z.string(),
            name: z.string(),
            innerDiameter: z.number(),
            outerDiameter: z.number(),
            thickness: z.number(),
            finishes: z.array(z.string())
        })
    )
}) satisfies z.ZodType<Catalog>;

export function getSize(
    catalog: Catalog,
    sizeId: string
): CatalogSize | undefined {
    return catalog.sizes.find((size) => size.id === sizeId);
}

export function getHead(
    catalog: Catalog,
    headId: string
): CatalogHead | undefined {
    return catalog.heads.find((head) => head.id === headId);
}

/** The lengths a vendor makes a size and head in, in a finish; none when it doesn't make them. */
export function getLengths(
    catalog: Catalog,
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
    catalog: Catalog,
    vendor: string,
    size: string,
    type: string
): CatalogNut | undefined {
    return catalog.nuts.find(
        (nut) => nut.vendor === vendor && nut.size === size && nut.type === type
    );
}

export function getWasher(
    catalog: Catalog,
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
