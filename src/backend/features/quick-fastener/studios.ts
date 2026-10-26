/**
 * Quick fastener's view of the library fasteners, as the library loaded them
 * (`FastenerSet`): each kind's parameters and where it's released, and
 * settling a screw, washer or nut onto what the studios make. A leaf module:
 * the client builds its options from these.
 *
 * A studio shows an input only where it offers a choice, and leaves one with
 * a single option anywhere out (the nut's vendor), so a choice's hidden and
 * fixed values come from the catalog, as the feature resolves them.
 */
import {
    type ConfigurationParameter,
    type EnumParameter,
    type PartialSelection,
    ParameterType,
    type Selection
} from "../configurations/contract";
import {
    normalizeSelection,
    onshapeOverrides,
    sameSelection,
    toSelection
} from "../configurations/selection";
import { type StudioLocation } from "../generated-parts/studios";
import { type Catalog } from "./catalog";

export enum FastenerKind {
    SCREW = "screw",
    WASHER = "washer",
    NUT = "nut"
}

/** The generated set the fasteners are in. */
export const FASTENERS = "fasteners";

export interface FastenerStudio {
    parameters: ConfigurationParameter[];
    location: StudioLocation;
    /** What a fasten mate names its mate connector by, as the studio's load found it. */
    mateConnectorId?: string;
}

/** The fasteners a library loaded: its manifest's catalog, and each kind's studio. */
export interface FastenerSet {
    catalog: Catalog;
    studios: Record<FastenerKind, FastenerStudio>;
}

/** Whether a head sits in a countersink, where no washer goes under it. */
export function isCountersunk(set: FastenerSet, head: string): boolean {
    const sizes = set.catalog.heads.find((each) => each.id === head)?.sizes;
    return Object.values(sizes ?? {}).some((size) => size.countersunk);
}

/** The vendor offering every standard length, without part numbers. */
export const GENERIC = "GENERIC";

/** The finish a screw's name leaves out. */
export const STANDARD_FINISH = "BLACK";

/** The studios' parameter ids, which robot-code names its inputs. */
export enum StudioInput {
    VENDOR = "vendor",
    SIZE = "size",
    HEAD = "head",
    LENGTH = "length",
    /** A screw's, `true` or `false`; hidden, and so false, where a length is only sold one way. */
    FULLY_THREADED = "fullyThreaded",
    TYPE = "type",
    /** A screw's, before its length, and a washer's, after its type. */
    FINISH = "finish"
}

interface Made {
    inputs: StudioInput[];
    parts: string[][];
}

/** What each kind's feature looks a part up by, in order, and every part made. */
function madeParts(catalog: Catalog): Record<FastenerKind, Made> {
    return {
        [FastenerKind.SCREW]: {
            inputs: [
                StudioInput.VENDOR,
                StudioInput.SIZE,
                StudioInput.HEAD,
                StudioInput.FINISH,
                StudioInput.LENGTH
            ],
            parts: catalog.screws.flatMap((screw) =>
                screw.lengths.map((length) => [
                    screw.vendor,
                    screw.size,
                    screw.head,
                    screw.finish,
                    length.id
                ])
            )
        },
        [FastenerKind.WASHER]: {
            inputs: [
                StudioInput.VENDOR,
                StudioInput.SIZE,
                StudioInput.TYPE,
                StudioInput.FINISH
            ],
            parts: catalog.washers.flatMap((washer) =>
                washer.finishes.map((finish) => [
                    washer.vendor,
                    washer.size,
                    washer.type,
                    finish
                ])
            )
        },
        [FastenerKind.NUT]: {
            inputs: [StudioInput.VENDOR, StudioInput.SIZE, StudioInput.TYPE],
            parts: catalog.nuts.map((nut) => [nut.vendor, nut.size, nut.type])
        }
    };
}

// Settling runs on every render of the form
const madeByCatalog = new WeakMap<Catalog, Record<FastenerKind, Made>>();

function made(set: FastenerSet, kind: FastenerKind): Made {
    let found = madeByCatalog.get(set.catalog);
    if (!found) {
        found = madeParts(set.catalog);
        madeByCatalog.set(set.catalog, found);
    }
    return found[kind];
}

/**
 * Each value that isn't made, where only one is, set to that one: as the
 * feature looks a part up, since a hidden input keeps whatever it last held.
 */
function resolveMade(
    set: FastenerSet,
    kind: FastenerKind,
    values: Selection
): Selection {
    const { inputs, parts } = made(set, kind);
    const resolved = { ...values };
    let matching = parts;
    inputs.forEach((input, index) => {
        const made = [...new Set(matching.map((part) => part[index]))];
        if (made.length === 1 && !made.includes(resolved[input])) {
            resolved[input] = made[0];
        }
        matching = matching.filter((part) => part[index] === resolved[input]);
    });
    return resolved;
}

/** A choice as its studio allows it: each value one shown with those before it, and the rest the one made. */
function settle(
    set: FastenerSet,
    kind: FastenerKind,
    choice: PartialSelection
): Selection {
    const { parameters } = set.studios[kind];
    const values: Selection = {};
    for (const input of made(set, kind).inputs) {
        values[input] = choice[input] ?? "";
    }
    return resolveMade(set, kind, {
        ...values,
        ...normalizeSelection(toSelection(choice, parameters), parameters)
    });
}

export interface ScrewChoice {
    vendor: string;
    size: string;
    head: string;
    finish: string;
    length: string;
    fullyThreaded: string;
}

/** A washer or a nut: its vendor, the screw's size, and its type, and a washer's finish. */
export interface PartChoice {
    vendor: string;
    size: string;
    type: string;
    finish?: string;
}

export function getParameter(
    set: FastenerSet,
    kind: FastenerKind,
    id: StudioInput
): EnumParameter | undefined {
    const parameter = set.studios[kind].parameters.find(
        (each) => each.id === id
    );
    return parameter?.type === ParameterType.ENUM ? parameter : undefined;
}

/** An option's name, e.g. `#10-32` for a size; its id when it has none. */
export function optionName(
    set: FastenerSet,
    kind: FastenerKind,
    id: StudioInput,
    value: string
): string {
    return (
        getParameter(set, kind, id)?.options.find(
            (option) => option.id === value
        )?.name ?? value
    );
}

/** A screw as its studio allows it: each choice one shown with those before it. */
export function settleScrew(
    set: FastenerSet,
    choice: PartialSelection
): ScrewChoice {
    return settle(set, FastenerKind.SCREW, choice) as unknown as ScrewChoice;
}

/** Whether a studio makes a choice, as it's settled. */
export function isMade(
    set: FastenerSet,
    kind: FastenerKind,
    choice: ScrewChoice | PartChoice
): boolean {
    const values: PartialSelection = { ...choice };
    const { inputs, parts } = made(set, kind);
    const part = inputs.map((input) => values[input]);
    return (
        sameSelection(values, settle(set, kind, values)) &&
        parts.some((each) =>
            each.every((value, index) => value === part[index])
        )
    );
}

/** The vendors making a washer or nut in a size, in the catalog's order. */
export function partVendors(
    set: FastenerSet,
    kind: FastenerKind,
    size: string
): string[] {
    const { catalog } = set;
    const parts = kind === FastenerKind.NUT ? catalog.nuts : catalog.washers;
    return catalog.vendors
        .map((vendor) => vendor.id)
        .filter((vendor) =>
            parts.some((part) => part.vendor === vendor && part.size === size)
        );
}

/**
 * A washer or nut for a screw, as its studio allows it: in the screw's size,
 * and from a vendor making it there. Under a Generic screw it's Generic; else
 * the vendor chosen, else the screw's, else Generic; else the first making it.
 * Undefined when nobody makes it in the size.
 */
export function settlePart(
    set: FastenerSet,
    kind: FastenerKind,
    choice: PartialSelection,
    screw: Pick<ScrewChoice, "vendor" | "size">
): PartChoice | undefined {
    const vendors = partVendors(set, kind, screw.size);
    const vendor =
        screw.vendor === GENERIC
            ? [GENERIC]
            : [choice[StudioInput.VENDOR], screw.vendor, GENERIC];
    const picked =
        vendor.find((each) => each !== undefined && vendors.includes(each)) ??
        vendors[0];
    if (picked === undefined) {
        return undefined;
    }
    return settle(set, kind, {
        ...choice,
        [StudioInput.VENDOR]: picked,
        [StudioInput.SIZE]: screw.size
    }) as unknown as PartChoice;
}

/** What a studio is inserted with: the choice's overrides of its defaults. */
export function studioConfiguration(
    set: FastenerSet,
    kind: FastenerKind,
    choice: ScrewChoice | PartChoice
): Selection {
    const { parameters } = set.studios[kind];
    return onshapeOverrides(toSelection({ ...choice }, parameters), parameters);
}
