import { Vendor, getLibraryVendors, parseVendor } from "../library/vendors";
import type { LibraryId } from "../library/library-id";
import {
    ParameterType,
    type ConfigurationParameter,
    type Selection
} from "../configurations/models";

/** A vendor named by one of a text's words, as its code or as its whole name. */
export function parseNameVendor(
    name: string,
    libraryId: LibraryId
): Vendor | undefined {
    const vendors = getLibraryVendors(libraryId);
    const words = name.match(/\b(\w+)\b/g) ?? [];
    for (const word of words) {
        const vendor = parseVendor(word, vendors);
        if (vendor !== undefined) return vendor;
    }
    return undefined;
}

/** A vendor an option names, as a token within its label or as the whole of it. */
function parseOptionVendor(
    optionName: string,
    libraryId: LibraryId
): Vendor | undefined {
    return (
        parseNameVendor(optionName, libraryId) ??
        parseVendor(optionName, getLibraryVendors(libraryId))
    );
}

export function parseVendors(
    name: string,
    parameters: ConfigurationParameter[],
    libraryId: LibraryId
): Vendor[] {
    const nameVendor = parseNameVendor(name, libraryId);
    if (nameVendor) return [nameVendor];

    const vendors = new Set<Vendor>();
    for (const param of parameters) {
        if (param.type !== ParameterType.ENUM) continue;
        for (const option of param.options) {
            const vendor = parseOptionVendor(option.name, libraryId);
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
    selection: Selection,
    parameters: ConfigurationParameter[],
    libraryId: LibraryId
): Vendor | undefined {
    for (const param of parameters) {
        if (param.type !== ParameterType.ENUM) continue;
        // An absent value is the parameter's default, which is what the
        // element's own probe — configured with nothing — resolves to.
        const selected = selection[param.id] ?? param.default;
        const option = param.options.find((o) => o.id === selected);
        const vendor = option && parseOptionVendor(option.name, libraryId);
        if (vendor) return vendor;
    }
    return partName ? parseNameVendor(partName, libraryId) : undefined;
}
