/** The vendors an insertable can come from, and how they are displayed. */
export enum Vendor {
    AM = "AM",
    LAI = "LAI",
    MCM = "MCM",
    REDUX = "Redux",
    REV = "REV",
    SDS = "SDS",
    SWYFT = "SWYFT",
    TTB = "TTB",
    VEX = "VEX",
    WCP = "WCP",
    /** Last, being the absence of a vendor: the team made it, so nobody sells
     * it and it has no part number. */
    CUSTOM = "Custom"
}

/**
 * Resolves the free text Onshape carries as a vendor to one we know, written
 * either as its code or as its full name.
 */
export function toVendor(vendor: string | undefined): Vendor | undefined {
    const text = vendor?.trim().toUpperCase();
    if (!text) {
        return undefined;
    }
    return Object.values(Vendor).find(
        (known) =>
            known.toUpperCase() === text ||
            getVendorName(known).toUpperCase() === text
    );
}

/**
 * The vendor a part number names itself, e.g. `WCP-1025` or `am-5833`. More
 * reliable than the vendor an insertable is tagged with, which is generic
 * wherever one part is configurable across several vendors.
 */
export function parsePartNumberVendor(
    partNumber: string | undefined
): Vendor | undefined {
    return toVendor(/^([A-Za-z]+)-/.exec(partNumber?.trim() ?? "")?.[1]);
}

/**
 * The vendor's page for a part, or its search for one where that is all the
 * site offers. Most vendors have no url derivable from a part number at all.
 */
export function getVendorPartUrl(
    vendor: Vendor | undefined,
    partNumber: string | undefined
): string | undefined {
    if (!partNumber) {
        return undefined;
    }
    const query = encodeURIComponent(partNumber);
    switch (vendor) {
        case Vendor.MCM:
            return `https://www.mcmaster.com/${query}/`;
        case Vendor.WCP:
            return `https://wcproducts.com/products/${query.toLowerCase()}`;
        case Vendor.AM:
            return `https://andymark.com/pages/search-results-page?q=${query.toLowerCase()}`;
        case Vendor.REV:
            return `https://www.revrobotics.com/search.php?search_query=${query}&section=product`;
        case Vendor.TTB:
            return `https://www.thethriftybot.com/search?type=product&q=${query}`;
        default:
            return undefined;
    }
}

/** Team-made, so it is expected to have no part number. */
export function isCustomPart(vendors: Vendor[]): boolean {
    return vendors.includes(Vendor.CUSTOM);
}

export function getVendorName(vendor: Vendor) {
    switch (vendor) {
        case Vendor.AM:
            return "AndyMark";
        case Vendor.CUSTOM:
            return "Custom";
        case Vendor.LAI:
            return "Last Anvil Innovations";
        case Vendor.MCM:
            return "McMaster-Carr";
        case Vendor.REDUX:
            return "Redux Robotics";
        case Vendor.REV:
            return "REV Robotics";
        case Vendor.SDS:
            return "Swerve Drive Specialties";
        case Vendor.SWYFT:
            return "SWYFT";
        case Vendor.TTB:
            return "The Thrifty Bot";
        case Vendor.VEX:
            return "VEXpro";
        case Vendor.WCP:
            return "West Coast Products";
    }
}
