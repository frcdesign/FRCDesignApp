/**
 * Import directly, not through `__test_utils__/index.ts`: the barrel reaches
 * `cloudflare:workers`, which the node project's tests cannot resolve.
 */
import {
    ParameterType,
    type BooleanParameter,
    type ConfigurationRecord,
    type EnumParameter,
    type QuantityParameter,
    type StringParameter,
    type UnitInfo,
    ParameterRole
} from "@backend/features/configurations/contract";
import { QuantityType, Unit } from "@backend/features/configurations/enums";
import { quantityDefault } from "@backend/features/configurations/selection";

/** Builds an enum parameter whose options are named after their ids. */
export function enumParam(
    id: string,
    optionIds: string[],
    extra: Partial<EnumParameter> = {}
): EnumParameter {
    return {
        id,
        name: id,
        default: optionIds[0],
        type: ParameterType.ENUM,
        options: optionIds.map((optionId) => ({
            id: optionId,
            name: optionId
        })),
        optionConditions: [],
        ...extra
    };
}

/** A single enum whose N options enumerate to N configurations. */
export function paramsWithConfigs(count: number): EnumParameter[] {
    return [
        enumParam(
            "A",
            Array.from({ length: count }, (_, i) => `o${i}`)
        )
    ];
}

export function boolParam(id: string): BooleanParameter {
    return {
        id,
        name: id,
        default: "false",
        type: ParameterType.BOOLEAN
    };
}

export function stringParam(id: string): StringParameter {
    return { id, name: id, default: "", type: ParameterType.STRING };
}

/** A text parameter recognized, as a load would, as a derivation variable. */
export function derivationParam(id: string): StringParameter {
    return {
        ...stringParam(id),
        name: "Derivation Variable",
        role: ParameterRole.DERIVATION_VARIABLE
    };
}

/**
 * A length quantity parameter defaulting to 1 inch, its default spelled the way
 * `parseOnshapeConfiguration` stores one: from `defaultValue` and `unit`.
 */
export function quantityParam(
    id: string,
    extra: Omit<Partial<QuantityParameter>, "default"> = {}
): QuantityParameter {
    const parameter = {
        id,
        name: id,
        type: ParameterType.QUANTITY as const,
        quantityType: QuantityType.LENGTH,
        defaultValue: 1,
        min: 0,
        max: 100,
        unit: Unit.INCH,
        ...extra
    };
    return { ...parameter, default: quantityDefault(parameter) };
}

/** Document units: inches to 4 decimals, degrees to 3. */
export const TEST_UNIT_INFO: UnitInfo = {
    angleUnit: Unit.DEGREE,
    lengthUnit: Unit.INCH,
    lengthPrecision: 4,
    anglePrecision: 3,
    realPrecision: 3
};

/** A probe of one configuration; override whichever fields a test is about. */
export function configurationRecord(
    overrides: Partial<ConfigurationRecord> = {}
): ConfigurationRecord {
    return {
        values: {},
        hasMultipleParts: false,
        isOpenComposite: false,
        ...overrides
    };
}
