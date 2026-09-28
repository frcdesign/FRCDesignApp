import { clean } from "../../lib/text";
import { LibraryId } from "./library-id";

/** A part number's leading letters, which name the vendor that sells it. */
const VENDOR_PREFIX = new RegExp("^([A-Za-z]+)-");

/** The vendors an insertable can come from, and how they are displayed. */
export enum Vendor {
    AB = "AB",
    AM = "AM",
    AXON = "AXON",
    BSRKR = "BSRKR",
    BWT = "BWT",
    CTRE = "CTRE",
    ELC = "ELC",
    FERRA = "Ferra",
    GB = "GB",
    LAI = "LAI",
    MATA = "MATA",
    MB = "MB",
    MCM = "MCM",
    MIS = "MIS",
    NORGREN = "Norgren",
    OS = "OS",
    PARKER = "Parker",
    REDUX = "Redux",
    REV = "REV",
    SDS = "SDS",
    SO = "SO",
    SWYFT = "SWYFT",
    TTB = "TTB",
    VEX = "VEX",
    WCP = "WCP",
    /** Made by the team, so nobody sells it. */
    CUSTOM = "Custom"
}

/** Who FRC teams buy from. */
const FRC_VENDORS: Vendor[] = [
    Vendor.AM,
    Vendor.AB,
    Vendor.CTRE,
    Vendor.NORGREN,
    Vendor.LAI,
    Vendor.MCM,
    Vendor.PARKER,
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
    Vendor.AXON,
    Vendor.BSRKR,
    Vendor.BWT,
    Vendor.ELC,
    Vendor.FERRA,
    Vendor.GB,
    Vendor.MATA,
    Vendor.MCM,
    Vendor.MB,
    Vendor.MIS,
    Vendor.OS,
    Vendor.REDUX,
    Vendor.REV,
    Vendor.SO,
    Vendor.SWYFT,
    Vendor.VEX,
    Vendor.WCP,
    Vendor.CUSTOM
];

/** What a library's filters offer. MKCad shares FRC's list. */
export function getLibraryVendors(libraryId: LibraryId): Vendor[] {
    return libraryId === LibraryId.FTC_DESIGN_LIB ? FTC_VENDORS : FRC_VENDORS;
}

/** Accepts a code or a full name. */
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

/** More precise than tagging, which is generic when a part spans vendors. */
export function parseVendorFromPartNumber(
    partNumber: string | undefined
): Vendor | undefined {
    return parseVendor(VENDOR_PREFIX.exec(clean(partNumber) ?? "")?.[1]);
}

/** Most vendors have no url derivable from a part number. */
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
            // Redirects to the product, or 404s.
            return `https://andymark.com/${query.toLowerCase()}`;
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

export function getVendorName(vendor: Vendor) {
    switch (vendor) {
        case Vendor.AB:
            return "ARMABOT";
        case Vendor.AM:
            return "AndyMark";
        case Vendor.AXON:
            return "Axon Robotics";
        case Vendor.BSRKR:
            return "Bsrkrbotics";
        case Vendor.BWT:
            return "BWTLink";
        case Vendor.CTRE:
            return "CTR Electronics";
        case Vendor.CUSTOM:
            return "Custom";
        case Vendor.ELC:
            return "East Loop Components";
        case Vendor.FERRA:
            return "Ferra Components";
        case Vendor.GB:
            return "goBILDA";
        case Vendor.LAI:
            return "Last Anvil Innovations";
        case Vendor.MATA:
            return "MATA Robotics";
        case Vendor.MB:
            return "Melonbotics";
        case Vendor.MCM:
            return "McMaster-Carr";
        case Vendor.MIS:
            return "Misumi";
        case Vendor.NORGREN:
            return "IMI Norgren";
        case Vendor.OS:
            return "Offset Robotics";
        case Vendor.PARKER:
            return "Parker";
        case Vendor.REDUX:
            return "Redux Robotics";
        case Vendor.REV:
            return "REV Robotics";
        case Vendor.SDS:
            return "Swerve Drive Specialties";
        case Vendor.SO:
            return "Sensorange";
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
