/**
 * Import directly, not through `__test_utils__/index.ts`: the barrel reaches
 * `cloudflare:workers`, which `src/shared`'s node-project tests cannot resolve.
 */
import {
    ParameterType,
    type BooleanParameter,
    type ConfigurationRecord,
    type EnumParameter,
    type QuantityParameter,
    type UnitInfo
} from "@backend/features/configurations/models";
import { QuantityType, Unit } from "@backend/features/configurations/enums";

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
        isCosmetic: false,
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
        isCosmetic: false,
        type: ParameterType.BOOLEAN
    };
}

/** Builds a length quantity parameter, defaulting to `1 in`. */
export function quantityParam(
    id: string,
    extra: Partial<QuantityParameter> = {}
): QuantityParameter {
    return {
        id,
        name: id,
        default: "1 in",
        isCosmetic: false,
        type: ParameterType.QUANTITY,
        quantityType: QuantityType.LENGTH,
        defaultValue: 1,
        min: 0,
        max: 100,
        unit: Unit.INCH,
        ...extra
    };
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
        canonicalConfiguration: {},
        hasMultipleParts: false,
        isOpenComposite: false,
        ...overrides
    };
}
