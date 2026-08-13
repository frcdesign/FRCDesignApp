import { Vendor, getVendorName } from "../../shared/types";
import {
    ParameterType,
    type ConfigurationParameter
} from "../../shared/configuration-models";

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
            const vendor = parseNameVendor(option.name);
            if (vendor) {
                vendors.add(vendor);
                continue;
            }
            const byFullName = Object.values(Vendor).find(
                (v) =>
                    getVendorName(v).toUpperCase() === option.name.toUpperCase()
            );
            if (byFullName) vendors.add(byFullName);
        }
    }
    return [...vendors];
}
