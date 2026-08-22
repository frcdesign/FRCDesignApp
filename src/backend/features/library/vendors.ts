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
 * The vendor's own page for a part. Most vendors have no url derivable from a
 * part number, so this is undefined for all but the few that do.
 */
export function getVendorPartUrl(
    vendor: Vendor | undefined,
    partNumber: string | undefined
): string | undefined {
    if (!partNumber) {
        return undefined;
    }
    switch (vendor) {
        case Vendor.MCM:
            return `https://www.mcmaster.com/${partNumber}/`;
        case Vendor.WCP:
            return `https://wcproducts.com/products/${partNumber.toLowerCase()}`;
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
