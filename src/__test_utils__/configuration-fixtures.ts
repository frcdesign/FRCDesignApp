/**
 * Configuration-parameter builders for tests.
 *
 * Deliberately not re-exported from `__test_utils__/index.ts`: the barrel pulls
 * in the database seeds, and importing that from a `src/shared` test would drag
 * the backend (and the Workers types it needs) into the frontend project. Import
 * this module directly instead.
 */
import {
    ParameterType,
    type BooleanParameter,
    type EnumParameter
} from "../shared/configuration-models";

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
