import { Vendor, parseVendor } from "../library/vendors";
import {
    ParameterType,
    type ConfigurationParameter,
    type PartialSelection
} from "../configurations/contract";

/** A vendor named by one of a text's words, as its code or as its whole name. */
export function parseNameVendor(name: string): Vendor | undefined {
    const words = name.match(/\b(\w+)\b/g) ?? [];
    for (const word of words) {
        const vendor = parseVendor(word);
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

/** The selected options name it more precisely than the part name, so they're read first. */
export function parseRecordVendor(
    partName: string | undefined,
    selection: PartialSelection,
    parameters: ConfigurationParameter[]
): Vendor | undefined {
    for (const param of parameters) {
        if (param.type !== ParameterType.ENUM) continue;
        // Absent means the default, which the element's own probe resolves to.
        const selected = selection[param.id] ?? param.default;
        const option = param.options.find((o) => o.id === selected);
        const vendor = option && parseOptionVendor(option.name);
        if (vendor) return vendor;
    }
    return partName ? parseNameVendor(partName) : undefined;
}
