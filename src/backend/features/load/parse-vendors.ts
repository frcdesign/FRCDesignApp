import { Vendor, parseVendor } from "../library/vendors";
import {
    ParameterType,
    type ConfigurationParameter,
    type Selection
} from "../configurations/models";

export function parseNameVendor(name: string): Vendor | undefined {
    const words = name.toUpperCase().match(/\b(\w+)\b/g) ?? [];
    for (const word of words) {
        const vendor = Object.values(Vendor).find(
            (v) => (v as string).toUpperCase() === word
        );
        if (vendor !== undefined) return vendor;
    }
    return undefined;
}

/** A vendor an option names, as a token within its label or as the whole of it. */
function parseOptionVendor(optionName: string): Vendor | undefined {
    return parseNameVendor(optionName) ?? parseVendor(optionName);
}

export function parseVendors(
    name: string,
    parameters: ConfigurationParameter[]
): Vendor[] {
    const nameVendor = parseNameVendor(name);
    if (nameVendor) return [nameVendor];

    const vendors = new Set<Vendor>();
    for (const param of parameters) {
        if (param.type !== ParameterType.ENUM) continue;
        for (const option of param.options) {
            const vendor = parseOptionVendor(option.name);
            if (vendor) vendors.add(vendor);
        }
    }
    return [...vendors];
}

/**
 * The vendor one configuration resolves to. Its selected options name it more
 * precisely than the part does, so they are read before the part's own name.
 */
export function parseRecordVendor(
    partName: string | undefined,
    configuration: Selection,
    parameters: ConfigurationParameter[]
): Vendor | undefined {
    for (const param of parameters) {
        if (param.type !== ParameterType.ENUM) continue;
        // An absent value is the parameter's default, which is what the
        // element's own probe — configured with nothing — resolves to.
        const selected = configuration[param.id] ?? param.default;
        const option = param.options.find((o) => o.id === selected);
        const vendor = option && parseOptionVendor(option.name);
        if (vendor) return vendor;
    }
    return partName ? parseNameVendor(partName) : undefined;
}
