/**
 * Quick fastener's own parameters, as `ConfigurationParameter`s so the
 * configuration dialog's inputs show them. None has a condition: the form
 * decides what shows, so a hidden choice keeps its value for when it's back.
 */
import {
    type ConfigurationParameter,
    type EnumParameter,
    OptionVisibilityType,
    ParameterType,
    type QuantityParameter,
    VisibilityType
} from "@backend/features/configurations/contract";
import { QuantityType, Unit } from "@backend/features/configurations/enums";
import { quantityDefault } from "@backend/features/configurations/selection";
import { Program } from "@backend/features/quick-fastener/catalog";
import {
    FastenerMode,
    SelectionMode,
    StopCondition
} from "@backend/features/quick-fastener/contract";
import {
    FastenerKind,
    type FastenerSet,
    getParameter,
    type ScrewChoice,
    StudioInput
} from "@backend/features/quick-fastener/studios";

export enum FormInput {
    SELECT_BY = "selectBy",
    PROGRAM = "program",
    STOP = "stop",
    MAX_LENGTH = "maxLength",
    MAX_GAP = "maxGap",
    MAX_THREAD_DEPTH = "maxThreadDepth"
}

function enumParameter(
    id: FormInput,
    name: string,
    options: { id: string; name: string }[]
): EnumParameter {
    return {
        type: ParameterType.ENUM,
        id,
        name,
        default: options[0].id,
        options,
        optionConditions: []
    };
}

/** Inches, as the document's own units show them. */
function inchParameter(
    id: FormInput,
    name: string,
    inches: { default: number; min: number; max: number }
): QuantityParameter {
    const quantity = {
        type: ParameterType.QUANTITY as const,
        id,
        name,
        quantityType: QuantityType.LENGTH,
        defaultValue: inches.default,
        min: inches.min,
        max: inches.max,
        unit: Unit.INCH
    };
    return { ...quantity, default: quantityDefault(quantity) };
}

export const FORM_PARAMETERS: ConfigurationParameter[] = [
    enumParameter(FormInput.SELECT_BY, "Select by", [
        { id: SelectionMode.FACES, name: "Faces" },
        { id: SelectionMode.LOCATIONS, name: "Circular edges" }
    ]),
    enumParameter(FormInput.PROGRAM, "Program", [
        { id: Program.FRC, name: "FRC" },
        { id: Program.FTC, name: "FTC" }
    ]),
    enumParameter(FormInput.STOP, "Stop condition", [
        { id: StopCondition.MAX_LENGTH, name: "Max length" },
        { id: StopCondition.FIRST_GAP, name: "First gap" }
    ]),
    inchParameter(FormInput.MAX_LENGTH, "Max length", {
        default: 3,
        min: 0.25,
        max: 10
    }),
    inchParameter(FormInput.MAX_GAP, "Max gap to ignore", {
        default: 0.03125,
        min: 0,
        max: 1
    }),
    inchParameter(FormInput.MAX_THREAD_DEPTH, "Max thread depth", {
        default: 0.5,
        min: 0.0625,
        max: 10
    })
];

export function formParameter(id: FormInput): ConfigurationParameter {
    const parameter = FORM_PARAMETERS.find((each) => each.id === id);
    if (!parameter) {
        throw new Error(`No form parameter ${id}`);
    }
    return parameter;
}

/** The Length option meaning "pick one for each hole". */
export const AUTOMATIC_LENGTH = "AUTOMATIC";

/**
 * The screw's Length with Automatic first: picking a length is preset mode,
 * and Automatic is automatic. Its other options are the studio's, shown as
 * the studio shows them.
 */
export function lengthParameter(set: FastenerSet): EnumParameter {
    const length = getParameter(set, FastenerKind.SCREW, StudioInput.LENGTH);
    if (!length) {
        throw new Error("The screw studio has no Length");
    }
    // An option no rule controls is hidden once there are rules
    const optionConditions = length.optionConditions.length
        ? [
              ...length.optionConditions,
              {
                  type: OptionVisibilityType.LIST as const,
                  controlledOptions: [AUTOMATIC_LENGTH],
                  condition: { type: VisibilityType.ALWAYS_SHOWN as const }
              }
          ]
        : [];
    return {
        ...length,
        default: AUTOMATIC_LENGTH,
        options: [
            { id: AUTOMATIC_LENGTH, name: "Automatic" },
            ...length.options
        ],
        optionConditions
    };
}

/** The Length option a mode and screw show as. */
export function lengthValue(mode: FastenerMode, screw: ScrewChoice): string {
    return mode === FastenerMode.AUTOMATIC ? AUTOMATIC_LENGTH : screw.length;
}
