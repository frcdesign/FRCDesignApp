/**
 * Quick fastener's choices: what's stored, settled into parts the studios make
 * (as the configuration dialog settles a selection), the options a run is
 * sent, and how a hole's plan reads.
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
import { type Program } from "@backend/features/quick-fastener/catalog";
import {
    FastenerMode,
    type FastenerOptions,
    HoleEnd,
    HoleStatus,
    type PlannedHole,
    type SelectionMode,
    type StopCondition
} from "@backend/features/quick-fastener/contract";
import {
    FastenerKind,
    isCountersunk,
    optionName,
    type PartChoice,
    type ScrewChoice,
    settlePart,
    settleScrew,
    STANDARD_FINISH,
    StudioInput
} from "@backend/features/quick-fastener/studios";
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
    /** Quick fastener's own parameters. */
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
    form: Selection;
    mode: FastenerMode;
    screw: ScrewChoice;
    /** Undefined where nobody makes the part in the screw's size. */
    parts: Record<Part, PartChoice | undefined>;
    /** Which parts go in: added, made in the size, and allowed by the rest. */
    added: Record<Part, boolean>;
}

export function settleChoices(choices: Choices): SettledChoices {
    const form = normalizeSelection(
        toSelection(choices.form, FORM_PARAMETERS),
        FORM_PARAMETERS
    );
    const screw = settleScrew(choices.screw);
    const parts = {
        [Part.SCREW_WASHER]: settlePart(
            FastenerKind.WASHER,
            choices.parts[Part.SCREW_WASHER],
            screw
        ),
        [Part.NUT]: settlePart(
            FastenerKind.NUT,
            choices.parts[Part.NUT],
            screw
        ),
        [Part.NUT_WASHER]: settlePart(
            FastenerKind.WASHER,
            choices.parts[Part.NUT_WASHER],
            screw
        )
    };
    const nut = choices.added[Part.NUT] && parts[Part.NUT] !== undefined;
    return {
        form,
        mode: choices.mode,
        screw,
        parts,
        added: {
            // A washer can't go under a flat head, which sits in its countersink
            [Part.SCREW_WASHER]:
                choices.added[Part.SCREW_WASHER] &&
                !isCountersunk(screw.head) &&
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
        maxLength: metres(form, FormInput.MAX_LENGTH),
        maxGap: metres(form, FormInput.MAX_GAP),
        maxThreadDepth: metres(form, FormInput.MAX_THREAD_DEPTH),
        replicate: form[FormInput.REPLICATE] === "true"
    };
}

export function selectionMode(settled: SettledChoices): SelectionMode {
    return settled.form[FormInput.SELECT_BY] as SelectionMode;
}

const END_NAMES: Record<HoleEnd, string> = {
    [HoleEnd.THROUGH]: "through",
    [HoleEnd.TAPPED]: "into threads",
    [HoleEnd.BLIND]: "into a blind hole"
};

/** e.g. `#10-32 x 7/8 in. Button head, Nylock nut`; or why the hole got nothing. */
export function describePlan(planned: PlannedHole): string {
    if (planned.status === HoleStatus.FASTENED) {
        return "Already fastened";
    }
    if (planned.status !== HoleStatus.READY || !planned.screw) {
        return planned.reason ?? "Can't be fastened";
    }
    const { screw } = planned;
    const name = (input: StudioInput, value: string) =>
        optionName(FastenerKind.SCREW, input, value);
    const beyondStandard = [
        ...(screw.finish === STANDARD_FINISH
            ? []
            : [name(StudioInput.FINISH, screw.finish)]),
        ...(screw.fullyThreaded === "true" ? ["fully threaded"] : [])
    ];
    const suffix =
        beyondStandard.length > 0 ? ` (${beyondStandard.join(", ")})` : "";
    const parts = [
        `${name(StudioInput.SIZE, screw.size)} x ${name(StudioInput.LENGTH, screw.length)} ${name(StudioInput.HEAD, screw.head)}${suffix}`
    ];
    if (planned.nut) {
        parts.push(
            `${optionName(FastenerKind.NUT, StudioInput.TYPE, planned.nut.type)} nut`
        );
    } else if (planned.end) {
        parts.push(END_NAMES[planned.end]);
    }
    return parts.join(", ");
}
