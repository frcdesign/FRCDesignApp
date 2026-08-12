/**
 * Configuration-parameter builders for tests.
 *
 * Import this module directly rather than through `__test_utils__/index.ts`.
 * `src/shared` tests run in vitest's `node` project (see vitest.config.ts), and
 * the barrel re-exports `test-app.ts`, which reaches `cloudflare:workers` —
 * unresolvable outside the Workers pool.
 */
import {
    ParameterType,
    type BooleanParameter,
    type EnumParameter,
    type QuantityParameter,
    type UnitInfo
} from "../shared/configuration-models";
import { QuantityType, Unit } from "../shared/configuration-enums";

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
