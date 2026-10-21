/**
 * Quick fastener's Part Studios: each one's configuration parameters, parsed
 * from the configuration robot-code writes to it as any element's is, and
 * where it's released. A leaf module: the client builds its options from these.
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
import { getVisibleOptions } from "../configurations/utils";
import { parseOnshapeConfiguration } from "../load/parse-configuration";
import { type OnshapeConfigurationResponse } from "../../lib/onshape/types";
import { COUNTERSUNK_HEADS, STUDIOS } from "./studios.gen";

export enum FastenerKind {
    SCREW = "screw",
    WASHER = "washer",
    NUT = "nut"
}

/** Where a studio is released; null until its Part Studio is made. */
export interface StudioLocation {
    documentId: string;
    versionId: string;
    elementId: string;
}

interface SyncedStudio {
    feature: string;
    configuration: Omit<OnshapeConfigurationResponse, "btType">;
    location: StudioLocation | null;
}

const synced = STUDIOS as unknown as Record<FastenerKind, SyncedStudio>;

export const STUDIO_PARAMETERS: Record<FastenerKind, ConfigurationParameter[]> =
    {
        [FastenerKind.SCREW]: parse(FastenerKind.SCREW),
        [FastenerKind.WASHER]: parse(FastenerKind.WASHER),
        [FastenerKind.NUT]: parse(FastenerKind.NUT)
    };

function parse(kind: FastenerKind): ConfigurationParameter[] {
    return parseOnshapeConfiguration({
        btType: "BTConfigurationResponse-2019",
        ...synced[kind].configuration
    });
}

/** Where a kind's studio is released; undefined until its Part Studio is made. */
export function getStudioLocation(
    kind: FastenerKind
): StudioLocation | undefined {
    return synced[kind].location ?? undefined;
}

/** Whether a head sits in a countersink, where no washer goes under it. */
export function isCountersunk(head: string): boolean {
    return COUNTERSUNK_HEADS.includes(head);
}

/** The vendor offering every standard length, without part numbers. */
export const GENERIC = "GENERIC";

/** The studios' parameter ids, which robot-code names its inputs. */
export enum StudioInput {
    VENDOR = "vendor",
    SIZE = "size",
    HEAD = "head",
    LENGTH = "length",
    TYPE = "type"
}

export interface ScrewChoice {
    vendor: string;
    size: string;
    head: string;
    length: string;
}

/** A washer or a nut: its vendor, the screw's size, and its type. */
export interface PartChoice {
    vendor: string;
    size: string;
    type: string;
}

export function getParameter(
    kind: FastenerKind,
    id: StudioInput
): EnumParameter | undefined {
    const parameter = STUDIO_PARAMETERS[kind].find((each) => each.id === id);
    return parameter?.type === ParameterType.ENUM ? parameter : undefined;
}

/** An option's name, e.g. `#10-32` for a size; its id when it has none. */
export function optionName(
    kind: FastenerKind,
    id: StudioInput,
    value: string
): string {
    return (
        getParameter(kind, id)?.options.find((option) => option.id === value)
            ?.name ?? value
    );
}

/** A screw as its studio allows it: each choice one shown with those before it. */
export function settleScrew(choice: PartialSelection): ScrewChoice {
    const parameters = STUDIO_PARAMETERS[FastenerKind.SCREW];
    return normalizeSelection(
        toSelection(choice, parameters),
        parameters
    ) as unknown as ScrewChoice;
}

/** Whether a studio makes a choice: each of its values one shown with those before it. */
export function isMade(
    kind: FastenerKind,
    choice: ScrewChoice | PartChoice
): boolean {
    const parameters = STUDIO_PARAMETERS[kind];
    const selection = toSelection({ ...choice }, parameters);
    return (
        sameSelection(selection, { ...choice }) &&
        sameSelection(normalizeSelection(selection, parameters), selection)
    );
}

/** The vendors making a washer or nut in a size, in the studio's order. */
export function partVendors(kind: FastenerKind, size: string): string[] {
    const parameters = STUDIO_PARAMETERS[kind];
    const vendor = getParameter(kind, StudioInput.VENDOR);
    const sizes = getParameter(kind, StudioInput.SIZE);
    if (!vendor || !sizes) {
        return [];
    }
    return vendor.options
        .map((option) => option.id)
        .filter((id) =>
            getVisibleOptions(
                sizes,
                { [StudioInput.VENDOR]: id },
                parameters
            ).some((option) => option.id === size)
        );
}

/**
 * A washer or nut for a screw, as its studio allows it: in the screw's size,
 * and from a vendor making it there. Under a Generic screw it's Generic; else
 * the vendor chosen, else the screw's, else Generic. Undefined when nobody
 * makes it in the size.
 */
export function settlePart(
    kind: FastenerKind,
    choice: PartialSelection,
    screw: Pick<ScrewChoice, "vendor" | "size">
): PartChoice | undefined {
    const vendors = partVendors(kind, screw.size);
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
    const parameters = STUDIO_PARAMETERS[kind];
    return normalizeSelection(
        toSelection(
            {
                ...choice,
                [StudioInput.VENDOR]: picked,
                [StudioInput.SIZE]: screw.size
            },
            parameters
        ),
        parameters
    ) as unknown as PartChoice;
}

/** What a studio is inserted with: the choice's overrides of its defaults. */
export function studioConfiguration(
    kind: FastenerKind,
    choice: ScrewChoice | PartChoice
): Selection {
    const parameters = STUDIO_PARAMETERS[kind];
    return onshapeOverrides(toSelection({ ...choice }, parameters), parameters);
}
