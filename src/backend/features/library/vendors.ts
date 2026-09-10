import { clean } from "../../lib/text";
import { LibraryId } from "./library-id";

/** A part number's leading letters, which name the vendor that sells it. */
const VENDOR_PREFIX = new RegExp("^([A-Za-z]+)-");

/** The vendors an insertable can come from, and how they are displayed. */
export enum Vendor {
    AM = "AM",
    AXN = "AXN",
    BWT = "BWT",
    GB = "GB",
    LAI = "LAI",
    MB = "MB",
    MCM = "MCM",
    MIS = "MIS",
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

/** Who FRC teams buy from. */
const FRC_VENDORS: Vendor[] = [
    Vendor.AM,
    Vendor.LAI,
    Vendor.MCM,
    Vendor.REDUX,
    Vendor.REV,
    Vendor.SDS,
    Vendor.SWYFT,
    Vendor.TTB,
    Vendor.VEX,
    Vendor.WCP,
    Vendor.CUSTOM
];

/** Who FTC teams buy from — overlapping with FRC, but its own list. */
const FTC_VENDORS: Vendor[] = [
    Vendor.AM,
    Vendor.AXN,
    Vendor.BWT,
    Vendor.GB,
    Vendor.MB,
    Vendor.MCM,
    Vendor.MIS,
    Vendor.REDUX,
    Vendor.REV,
    Vendor.SWYFT,
    Vendor.VEX,
    Vendor.WCP,
    Vendor.CUSTOM
];

/**
 * The vendors a library stocks, which is what its filters offer. Tagging stays
 * library-generic. MKCad is FRC, so it shares that list.
 */
export function getLibraryVendors(libraryId: LibraryId): Vendor[] {
    return libraryId === LibraryId.FTC_DESIGN_LIB ? FTC_VENDORS : FRC_VENDORS;
}

/**
 * Resolves the free text Onshape carries as a vendor to one we know, written
 * either as its code or as its full name.
 */
export function parseVendor(vendor: string | undefined): Vendor | undefined {
    const text = clean(vendor)?.toUpperCase();
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
 * The vendor a part number names itself, e.g. `WCP-1025` — more precise than an
 * insertable's tagging, which is generic wherever one part spans vendors.
 */
export function parseVendorFromPartNumber(
    partNumber: string | undefined
): Vendor | undefined {
    return parseVendor(VENDOR_PREFIX.exec(clean(partNumber) ?? "")?.[1]);
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
        case Vendor.GB:
            return `https://www.gobilda.com/search-results-page?q=${query}`;
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
        case Vendor.AXN:
            return "Axon Robotics";
        case Vendor.BWT:
            return "BWTLink";
        case Vendor.CUSTOM:
            return "Custom";
        case Vendor.GB:
            return "goBILDA";
        case Vendor.LAI:
            return "Last Anvil Innovations";
        case Vendor.MB:
            return "Melonbotics";
        case Vendor.MCM:
            return "McMaster-Carr";
        case Vendor.MIS:
            return "Misumi";
        case Vendor.REDUX:
            return "Redux Robotics";
        case Vendor.REV:
            return "REV Robotics";
        case Vendor.SDS:
            return "Swerve Drive Specialties";
        case Vendor.SWYFT:
            return "SWYFT Robotics";
        case Vendor.TTB:
            return "The Thrifty Bot";
        case Vendor.VEX:
            return "VEXpro";
        case Vendor.WCP:
            return "West Coast Products";
    }
}
