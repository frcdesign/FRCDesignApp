/**
 * Quick fastener's catalog, as robot-code's `quickFastenerTables.py` defines it
 * (synced into `catalog.gen.ts`). A leaf module: the client reads it too.
 * Lengths are metres.
 */
import { CATALOG } from "./catalog.gen";

/** FTC's fasteners aren't in the catalog yet. */
export enum Program {
    FRC = "frc",
    FTC = "ftc"
}

export enum FastenerKind {
    SCREW = "screw",
    WASHER = "washer",
    NUT = "nut"
}

/** What every catalog part carries, where its vendor has them. */
interface Stocked {
    partNumber?: string;
    url?: string;
}

export interface CatalogInput {
    id: string;
    name: string;
    kind: "list" | "boolean";
    default: string;
    options?: { id: string; name: string }[];
}

/** Where a studio is released; null until its Part Studio is made. */
export interface StudioLocation {
    documentId: string;
    versionId: string;
    elementId: string;
}

export interface CatalogStudio {
    feature: string;
    inputs: CatalogInput[];
    location: StudioLocation | null;
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

export interface CatalogLength extends Stocked {
    id: string;
    name: string;
    length: number;
}

/** The lengths a vendor makes a size and head in, shortest first. */
export interface CatalogScrew {
    vendor: string;
    size: string;
    head: string;
    lengths: CatalogLength[];
}

export interface CatalogNut extends Stocked {
    vendor: string;
    size: string;
    type: string;
    acrossFlats: number;
    height: number;
}

export interface CatalogWasher extends Stocked {
    vendor: string;
    size: string;
    type: string;
    name: string;
    innerDiameter: number;
    outerDiameter: number;
    thickness: number;
}

/** The washer a screw or nut of a vendor and size sits on, when it has one. */
export interface SeatWasher {
    vendor: string;
    size: string;
    washerVendor: string;
    washerType: string;
}

export interface Catalog {
    studios: Record<FastenerKind, CatalogStudio>;
    vendors: CatalogVendor[];
    sizes: CatalogSize[];
    heads: CatalogHead[];
    screws: CatalogScrew[];
    nutTypes: { id: string; name: string }[];
    nuts: CatalogNut[];
    washers: CatalogWasher[];
    seatWashers: SeatWasher[];
}

export const catalog: Catalog = CATALOG as Catalog;

/** The vendor offering every standard length, without part numbers. */
export const GENERIC = "GENERIC";

export function getCatalog(program: Program): Catalog | undefined {
    return program === Program.FRC ? catalog : undefined;
}

export function getSize(sizeId: string): CatalogSize | undefined {
    return catalog.sizes.find((size) => size.id === sizeId);
}

export function getHead(headId: string): CatalogHead | undefined {
    return catalog.heads.find((head) => head.id === headId);
}

export function getVendorName(vendorId: string): string {
    return (
        catalog.vendors.find((vendor) => vendor.id === vendorId)?.name ??
        vendorId
    );
}

/** The lengths a vendor makes a size and head in; none when it doesn't make them. */
export function getLengths(
    vendor: string,
    size: string,
    head: string
): CatalogLength[] {
    return (
        catalog.screws.find(
            (screw) =>
                screw.vendor === vendor &&
                screw.size === size &&
                screw.head === head
        )?.lengths ?? []
    );
}

/** The screw vendors, in the catalog's order. */
export function getScrewVendors(): CatalogVendor[] {
    return catalog.vendors.filter((vendor) =>
        catalog.screws.some((screw) => screw.vendor === vendor.id)
    );
}

export function getScrewSizes(vendor: string): CatalogSize[] {
    return catalog.sizes.filter((size) =>
        catalog.screws.some(
            (screw) => screw.vendor === vendor && screw.size === size.id
        )
    );
}

export function getScrewHeads(vendor: string, size?: string): CatalogHead[] {
    return catalog.heads.filter((head) =>
        catalog.screws.some(
            (screw) =>
                screw.vendor === vendor &&
                (size === undefined || screw.size === size) &&
                screw.head === head.id
        )
    );
}

/** The vendor whose nuts go with a screw vendor's: its own, else Generic's. */
export function getNutVendor(screwVendor: string): string {
    return catalog.nuts.some((nut) => nut.vendor === screwVendor)
        ? screwVendor
        : GENERIC;
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

/** The nut types made in a size, by any vendor. */
export function getNutTypes(size?: string): { id: string; name: string }[] {
    return catalog.nutTypes.filter((type) =>
        catalog.nuts.some(
            (nut) =>
                nut.type === type.id &&
                (size === undefined || nut.size === size)
        )
    );
}

/** The washer a screw or nut of a vendor and size sits on. */
export function getSeatWasher(
    vendor: string,
    size: string
): CatalogWasher | undefined {
    const seat = catalog.seatWashers.find(
        (each) => each.vendor === vendor && each.size === size
    );
    return seat
        ? catalog.washers.find(
              (washer) =>
                  washer.vendor === seat.washerVendor &&
                  washer.size === size &&
                  washer.type === seat.washerType
          )
        : undefined;
}

/** Each input's option (or `"true"`/`"false"`), keyed by input id: the configuration a studio is inserted with. */
export type FastenerConfiguration = Record<string, string>;

export interface ScrewChoice {
    vendor: string;
    size: string;
    head: string;
    length: string;
    /** Sits on its seat washer. */
    washer: boolean;
}

export interface WasherChoice {
    vendor: string;
    size: string;
    type: string;
}

export interface NutChoice {
    vendor: string;
    size: string;
    type: string;
    /** Sits on its seat washer. */
    washer: boolean;
}

export function screwConfiguration(screw: ScrewChoice): FastenerConfiguration {
    return {
        vendor: screw.vendor,
        size: screw.size,
        head: screw.head,
        length: screw.length,
        washer: String(screw.washer)
    };
}

export function washerConfiguration(
    washer: WasherChoice
): FastenerConfiguration {
    return { vendor: washer.vendor, size: washer.size, type: washer.type };
}

export function nutConfiguration(nut: NutChoice): FastenerConfiguration {
    return {
        vendor: nut.vendor,
        size: nut.size,
        type: nut.type,
        washer: String(nut.washer)
    };
}

/** The washer a seated part sits on, as a choice to insert. */
export function seatWasherChoice(
    vendor: string,
    size: string
): WasherChoice | undefined {
    const washer = getSeatWasher(vendor, size);
    return washer
        ? { vendor: washer.vendor, size, type: washer.type }
        : undefined;
}
