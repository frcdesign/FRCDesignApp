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
    type StopCondition
} from "@backend/features/auto-assembly/contract";
import {
    FastenerKind,
    type FastenerSet,
    isCountersunk,
    type PartChoice,
    type ScrewChoice,
    settlePart,
    settleScrew
} from "@backend/features/auto-assembly/studios";
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
    /** Undefined where nobody makes the part in the screw's size. */
    parts: Record<Part, PartChoice | undefined>;
    /** Which parts go in: added, made in the size, and allowed by the rest. */
    added: Record<Part, boolean>;
}

export function settleChoices(
    set: FastenerSet,
    choices: Choices
): SettledChoices {
    const form = normalizeSelection(
        toSelection(choices.form, FORM_PARAMETERS),
        FORM_PARAMETERS
    );
    const screw = settleScrew(set, choices.screw);
    const parts = {
        [Part.SCREW_WASHER]: settlePart(
            set,
            FastenerKind.WASHER,
            choices.parts[Part.SCREW_WASHER],
            screw
        ),
        [Part.NUT]: settlePart(
            set,
            FastenerKind.NUT,
            choices.parts[Part.NUT],
            screw
        ),
        [Part.NUT_WASHER]: settlePart(
            set,
            FastenerKind.WASHER,
            choices.parts[Part.NUT_WASHER],
            screw
        )
    };
    const nut = choices.added[Part.NUT] && parts[Part.NUT] !== undefined;
    return {
        set,
        form,
        mode: choices.mode,
        screw,
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
    return {
        program: form[FormInput.PROGRAM] as Program,
        mode: settled.mode,
        screw: settled.screw,
        screwWasher: part(Part.SCREW_WASHER),
        nut: part(Part.NUT),
        nutWasher: part(Part.NUT_WASHER),
        stop: form[FormInput.STOP] as StopCondition,
        maxLength:
            form[FormInput.LIMIT_LENGTH] === "true"
                ? metres(form, FormInput.MAX_LENGTH)
                : undefined,
        maxGap: metres(form, FormInput.MAX_GAP),
        maxThreadDepth: metres(form, FormInput.MAX_THREAD_DEPTH)
    };
}

export function selectionMode(settled: SettledChoices): SelectionMode {
    return settled.form[FormInput.SELECT_BY] as SelectionMode;
}
