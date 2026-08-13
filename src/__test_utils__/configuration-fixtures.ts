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
