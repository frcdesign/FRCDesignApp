/** The vendors an insertable can come from, and how they are displayed. */
export enum Vendor {
    AM = "AM",
    /** Marks a part the team made, so nobody sells it and it has no part number. */
    CUSTOM = "Custom",
    LAI = "LAI",
    MCM = "MCM",
    REDUX = "Redux",
    REV = "REV",
    SDS = "SDS",
    SWYFT = "SWYFT",
    TTB = "TTB",
    VEX = "VEX",
    WCP = "WCP"
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
