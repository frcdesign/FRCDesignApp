/**
 * Auto Assembly's choices: what's stored, settled into parts the studios make
 * (as the configuration dialog settles a selection), and the options a run is
 * sent.
 */
import {
    type PartialSelection,
    type Selection
} from "@backend/features/configurations/contract";
import { QuantityType, Unit } from "@backend/features/configurations/enums";
import { evaluateBaseValue } from "@backend/features/configurations/input-parser";
import {
    normalizeSelection,
    toSelection
} from "@backend/features/configurations/selection";
import { type Program } from "@backend/features/auto-assembly/catalog";
import {
    FastenerMode,
    type FastenerOptions,
    type SelectionMode,
    StopCondition
} from "@backend/features/auto-assembly/contract";
import {
    FastenerKind,
    type FastenerSet,
    isCountersunk,
    type PartChoice,
    type ScrewChoice,
    GENERIC,
    partVendors,
    settlePart,
    settleScrew,
    StudioInput
} from "@backend/features/auto-assembly/studios";
import {
    GenericVendorPolicy,
    NO_PREFERENCES,
    type VendorPreferences
} from "@backend/features/teams/contract";
import { preferredVendor } from "../teams/vendor-ranking";
import { FORM_PARAMETERS, FormInput, formParameter } from "./parameters";

/** The washers and nut that go with a screw. */
export enum Part {
    SCREW_WASHER = "screwWasher",
    NUT = "nut",
    NUT_WASHER = "nutWasher"
}

export const PART_KIND: Record<Part, FastenerKind> = {
    [Part.SCREW_WASHER]: FastenerKind.WASHER,
    [Part.NUT]: FastenerKind.NUT,
    [Part.NUT_WASHER]: FastenerKind.WASHER
};

/** What's chosen, as it was entered; `settleChoices` makes it whole. */
export interface Choices {
    /** Auto Assembly's own parameters. */
    form: PartialSelection;
    mode: FastenerMode;
    screw: PartialSelection;
    parts: Record<Part, PartialSelection>;
    added: Record<Part, boolean>;
}

export function defaultChoices(): Choices {
    return {
        form: {},
        mode: FastenerMode.AUTOMATIC,
        screw: {},
        parts: {
            [Part.SCREW_WASHER]: {},
            [Part.NUT]: {},
            [Part.NUT_WASHER]: {}
        },
        added: {
            [Part.SCREW_WASHER]: false,
            [Part.NUT]: true,
            [Part.NUT_WASHER]: false
        }
    };
}

/** The choices made whole: every value one its parameter shows. */
export interface SettledChoices {
    /** What they were settled onto. */
    set: FastenerSet;
    form: Selection;
    mode: FastenerMode;
    screw: ScrewChoice;
    /** The team's, which decides which vendor inputs show. */
    generic: GenericVendorPolicy;
    /** Undefined where nobody makes the part in the screw's size. */
    parts: Record<Part, PartChoice | undefined>;
    /** Which parts go in: added, made in the size, and allowed by the rest. */
    added: Record<Part, boolean>;
}

/**
 * The screw's vendor as the team's preferences have it. Require and Ban hold
 * whatever was picked; the rest only fill a vendor nobody picked.
 */
function preferredScrewVendor(
    set: FastenerSet,
    picked: string | undefined,
    { ranking, generic }: VendorPreferences
): string | undefined {
    const makers = new Set(set.catalog.screws.map((screw) => screw.vendor));
    const vendors = set.catalog.vendors.filter((each) => makers.has(each.id));
    const others = vendors.filter((each) => each.id !== GENERIC);
    const bestOther = () => (preferredVendor(others, ranking) ?? others[0])?.id;
    const makesGeneric = makers.has(GENERIC);

    switch (generic) {
        case GenericVendorPolicy.REQUIRE:
            return makesGeneric ? GENERIC : picked;
        case GenericVendorPolicy.BAN:
            return picked !== undefined && picked !== GENERIC
                ? picked
                : bestOther();
        case GenericVendorPolicy.PREFER:
            return picked ?? (makesGeneric ? GENERIC : bestOther());
        case GenericVendorPolicy.AVOID:
            return picked ?? bestOther();
        case GenericVendorPolicy.ANY:
            return picked ?? preferredVendor(vendors, ranking)?.id;
    }
}

/** Under Ban, a part settled onto Generic moves to the first other vendor making it, or goes. */
function withoutGeneric(
    set: FastenerSet,
    kind: FastenerKind,
    choice: PartialSelection,
    screw: ScrewChoice,
    settled: PartChoice | undefined
): PartChoice | undefined {
    if (settled?.vendor !== GENERIC) return settled;
    const vendor = partVendors(set, kind, screw.size).find(
        (each) => each !== GENERIC
    );
    return vendor === undefined
        ? undefined
        : settlePart(
              set,
              kind,
              { ...choice, [StudioInput.VENDOR]: vendor },
              screw
          );
}

export function settleChoices(
    set: FastenerSet,
    choices: Choices,
    preferences: VendorPreferences = NO_PREFERENCES
): SettledChoices {
    const form = normalizeSelection(
        toSelection(choices.form, FORM_PARAMETERS),
        FORM_PARAMETERS
    );
    const vendor = preferredScrewVendor(
        set,
        choices.screw[StudioInput.VENDOR],
        preferences
    );
    const screw = settleScrew(
        set,
        vendor === undefined
            ? choices.screw
            : { ...choices.screw, [StudioInput.VENDOR]: vendor }
    );
    const part = (each: Part) => {
        const kind = PART_KIND[each];
        const settled = settlePart(set, kind, choices.parts[each], screw);
        return preferences.generic === GenericVendorPolicy.BAN
            ? withoutGeneric(set, kind, choices.parts[each], screw, settled)
            : settled;
    };
    const parts = {
        [Part.SCREW_WASHER]: part(Part.SCREW_WASHER),
        [Part.NUT]: part(Part.NUT),
        [Part.NUT_WASHER]: part(Part.NUT_WASHER)
    };
    const nut = choices.added[Part.NUT] && parts[Part.NUT] !== undefined;
    return {
        set,
        form,
        mode: choices.mode,
        screw,
        generic: preferences.generic,
        parts,
        added: {
            // A washer can't go under a flat head, which sits in its countersink
            [Part.SCREW_WASHER]:
                choices.added[Part.SCREW_WASHER] &&
                !isCountersunk(set, screw.head) &&
                parts[Part.SCREW_WASHER] !== undefined,
            [Part.NUT]: nut,
            [Part.NUT_WASHER]:
                nut &&
                choices.added[Part.NUT_WASHER] &&
                parts[Part.NUT_WASHER] !== undefined
        }
    };
}

/** A quantity in metres, or its default's where it doesn't evaluate. */
function metres(form: Selection, id: FormInput): number {
    const parameter = formParameter(id);
    const evaluate = (value: string) =>
        evaluateBaseValue(value, QuantityType.LENGTH, Unit.INCH)?.value;
    return evaluate(form[id]) ?? evaluate(parameter.default) ?? 0;
}

/** What a run is sent: the parts added, and the limits in metres. */
export function fastenerOptions(settled: SettledChoices): FastenerOptions {
    const { form, parts, added } = settled;
    const part = (each: Part) => (added[each] ? parts[each] : undefined);
    // The form asks for a stop condition only for an automatic screw
    const stop =
        settled.mode === FastenerMode.AUTOMATIC
            ? (form[FormInput.STOP] as StopCondition)
            : StopCondition.ALL_HOLES;
    return {
        program: form[FormInput.PROGRAM] as Program,
        mode: settled.mode,
        screw: settled.screw,
        screwWasher: part(Part.SCREW_WASHER),
        nut: part(Part.NUT),
        nutWasher: part(Part.NUT_WASHER),
        stop,
        maxLength:
            stop === StopCondition.MAX_LENGTH
                ? metres(form, FormInput.MAX_LENGTH)
                : undefined,
        maxThreadDepth: metres(form, FormInput.MAX_THREAD_DEPTH)
    };
}

export function selectionMode(settled: SettledChoices): SelectionMode {
    return settled.form[FormInput.SELECT_BY] as SelectionMode;
}
