/**
 * Auto Assembly's own parameters, as `ConfigurationParameter`s so the
 * configuration dialog's inputs show them. None has a condition: the form
 * decides what shows, so a hidden choice keeps its value for when it's back.
 */
import {
    type BooleanParameter,
    type ConfigurationParameter,
    type EnumParameter,
    ParameterType,
    type QuantityParameter
} from "@backend/features/configurations/contract";
import { QuantityType, Unit } from "@backend/features/configurations/enums";
import { quantityDefault } from "@backend/features/configurations/selection";
import { Program } from "@backend/features/auto-assembly/catalog";
import { m } from "../../paraglide/messages";
import {
    FastenerMode,
    SelectionMode,
    StopCondition
} from "@backend/features/auto-assembly/contract";

export enum FormInput {
    SELECT_BY = "selectBy",
    PROGRAM = "program",
    STOP = "stop",
    LIMIT_LENGTH = "limitLength",
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

function booleanParameter(id: FormInput, name: string): BooleanParameter {
    return { type: ParameterType.BOOLEAN, id, name, default: "false" };
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
    enumParameter(FormInput.SELECT_BY, m.autoAssemblySelectBy(), [
        { id: SelectionMode.LOCATIONS, name: m.autoAssemblyCircularEdges() },
        { id: SelectionMode.FACES, name: m.autoAssemblyFaces() }
    ]),
    enumParameter(FormInput.PROGRAM, m.autoAssemblyProgram(), [
        { id: Program.FRC, name: "FRC" },
        { id: Program.FTC, name: "FTC" }
    ]),
    enumParameter(FormInput.STOP, m.autoAssemblyStopCondition(), [
        { id: StopCondition.ALL_HOLES, name: m.autoAssemblyStopAllHoles() },
        { id: StopCondition.FIRST_GAP, name: m.autoAssemblyStopFirstGap() }
    ]),
    booleanParameter(FormInput.LIMIT_LENGTH, m.autoAssemblyLimitLength()),
    inchParameter(FormInput.MAX_LENGTH, m.autoAssemblyMaxLength(), {
        default: 3,
        min: 0.25,
        max: 10
    }),
    inchParameter(FormInput.MAX_GAP, m.autoAssemblyMaxGap(), {
        default: 0.03125,
        min: 0,
        max: 1
    }),
    inchParameter(FormInput.MAX_THREAD_DEPTH, m.autoAssemblyMaxThreadDepth(), {
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
    name: m.autoAssemblySizing(),
    default: FastenerMode.AUTOMATIC,
    options: [
        { id: FastenerMode.AUTOMATIC, name: m.autoAssemblySizingAutomatic() },
        { id: FastenerMode.PRESET, name: m.autoAssemblySizingManual() }
    ],
    optionConditions: []
};
