/**
 * A team's vendor preferences applied to a part's Vendor parameters. A leaf:
 * the insert menu shows what the insert routes apply, through the same code.
 */
import {
    type ConfigurationParameter,
    type EnumOption,
    type EnumParameter,
    ParameterRole,
    ParameterType,
    type Selection
} from "../configurations/contract";
import { isGenericOption, optionVendor } from "../library/vendor-options";
import { type Vendor } from "../library/vendors";
import { GenericVendorPolicy, type VendorPreferences } from "./contract";

function isVendorParameter(
    parameter: ConfigurationParameter
): parameter is EnumParameter {
    return (
        parameter.role === ParameterRole.VENDOR &&
        parameter.type === ParameterType.ENUM
    );
}

function rankOf(option: EnumOption, ranking: Vendor[]): number {
    const vendor = optionVendor(option.name);
    const rank = vendor === undefined ? -1 : ranking.indexOf(vendor);
    return rank < 0 ? ranking.length : rank;
}

/** The best-ranked option, ties to the parameter's order; undefined when there are none. */
function bestOption(
    options: EnumOption[],
    ranking: Vendor[]
): EnumOption | undefined {
    return [...options].sort(
        (a, b) => rankOf(a, ranking) - rankOf(b, ranking)
    )[0];
}

/**
 * A Vendor parameter as the policy offers it: undefined to hide it, under
 * Require or where Ban leaves one option, and Generic left out under Ban.
 * Any other parameter is returned as it is.
 */
export function offeredVendorParameter(
    parameter: ConfigurationParameter,
    generic: GenericVendorPolicy
): ConfigurationParameter | undefined {
    if (parameter.type !== ParameterType.ENUM) return parameter;
    const hasGeneric = parameter.options.some((option) =>
        isGenericOption(option.name)
    );
    if (!hasGeneric) return parameter;
    if (generic === GenericVendorPolicy.REQUIRE) return undefined;
    if (generic !== GenericVendorPolicy.BAN) return parameter;
    const options = parameter.options.filter(
        (option) => !isGenericOption(option.name)
    );
    return options.length > 1 ? { ...parameter, options } : undefined;
}

/** Whether the menu offers the parameter at all, for a parameter the policy may hide. */
export function isVendorParameterShown(
    parameter: ConfigurationParameter,
    generic: GenericVendorPolicy
): boolean {
    return (
        !isVendorParameter(parameter) ||
        offeredVendorParameter(parameter, generic) !== undefined
    );
}

/**
 * Each Vendor parameter held to the policy: Generic under Require, anything
 * else under Ban. On `opening` a part at its defaults, an untouched Vendor
 * also takes the team's preference: Generic, or its best-ranked other vendor.
 */
export function applyVendorPreferences(
    selection: Selection,
    parameters: ConfigurationParameter[],
    { ranking, generic }: VendorPreferences,
    opening: boolean
): Selection {
    let next = selection;
    for (const parameter of parameters.filter(isVendorParameter)) {
        const current = selection[parameter.id];
        const genericOption = parameter.options.find((option) =>
            isGenericOption(option.name)
        );
        const others = parameter.options.filter(
            (option) => option !== genericOption
        );
        const isGeneric = current === genericOption?.id;
        const atDefault = opening && current === parameter.default;

        let wanted: string | undefined;
        if (generic === GenericVendorPolicy.REQUIRE) {
            wanted = genericOption?.id;
        } else if (generic === GenericVendorPolicy.BAN && isGeneric) {
            wanted = bestOption(others, ranking)?.id;
        } else if (atDefault) {
            wanted = preferredOption(
                generic,
                genericOption,
                others,
                ranking,
                parameter.options
            )?.id;
        }
        if (wanted !== undefined && wanted !== current) {
            next = { ...next, [parameter.id]: wanted };
        }
    }
    return next;
}

function preferredOption(
    generic: GenericVendorPolicy,
    genericOption: EnumOption | undefined,
    others: EnumOption[],
    ranking: Vendor[],
    options: EnumOption[]
): EnumOption | undefined {
    switch (generic) {
        case GenericVendorPolicy.REQUIRE:
        case GenericVendorPolicy.PREFER:
            return genericOption ?? bestRanked(others, ranking);
        case GenericVendorPolicy.AVOID:
        case GenericVendorPolicy.BAN:
            return bestRanked(others, ranking) ?? others[0];
        case GenericVendorPolicy.ANY:
            return bestRanked(options, ranking);
    }
}

/** Only an option the ranking names; the part's own default stands otherwise. */
function bestRanked(
    options: EnumOption[],
    ranking: Vendor[]
): EnumOption | undefined {
    const best = bestOption(options, ranking);
    return best && rankOf(best, ranking) < ranking.length ? best : undefined;
}
