/**
 * Quick fastener's own parameters, as `ConfigurationParameter`s so the
 * configuration dialog's inputs show them. None has a condition: the form
 * decides what shows, so a hidden choice keeps its value for when it's back.
 */
import {
    type ConfigurationParameter,
    type EnumParameter,
    ParameterType,
    type QuantityParameter
} from "@backend/features/configurations/contract";
import { QuantityType, Unit } from "@backend/features/configurations/enums";
import { quantityDefault } from "@backend/features/configurations/selection";
import { Program } from "@backend/features/quick-fastener/catalog";
import {
    FastenerMode,
    SelectionMode,
    StopCondition
} from "@backend/features/quick-fastener/contract";

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
        { id: SelectionMode.LOCATIONS, name: "Circular edges" },
        { id: SelectionMode.FACES, name: "Faces" }
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

/** Whether the screw's length is picked for each hole or chosen once. */
export const SIZING_PARAMETER: EnumParameter = {
    type: ParameterType.ENUM,
    id: "sizing",
    name: "Sizing",
    default: FastenerMode.AUTOMATIC,
    options: [
        { id: FastenerMode.AUTOMATIC, name: "Automatic" },
        { id: FastenerMode.PRESET, name: "Manual" }
    ],
    optionConditions: []
};
