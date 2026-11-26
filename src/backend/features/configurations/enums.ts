/** As Onshape sends them. */

export enum QuantityType {
    LENGTH = "LENGTH",
    ANGLE = "ANGLE",
    INTEGER = "INTEGER",
    REAL = "REAL",
    /** A document's mass unit; no configuration parameter is one. */
    MASS = "MASS"
}

export enum Unit {
    METER = "meter",
    CENTIMETER = "centimeter",
    MILLIMETER = "millimeter",
    YARD = "yard",
    FOOT = "foot",
    INCH = "inch",
    DEGREE = "degree",
    RADIAN = "radian",
    KILOGRAM = "kilogram",
    GRAM = "gram",
    POUND = "pound",
    OUNCE = "ounce",
    UNITLESS = ""
}

/** The units a mass can be shown in. */
export const MASS_UNITS = [
    Unit.KILOGRAM,
    Unit.GRAM,
    Unit.POUND,
    Unit.OUNCE
] as const;

export type MassUnit = (typeof MASS_UNITS)[number];

export function getUnitDisplayStr(unit: Unit): string {
    switch (unit) {
        case Unit.METER:
            return "m";
        case Unit.CENTIMETER:
            return "cm";
        case Unit.MILLIMETER:
            return "mm";
        case Unit.YARD:
            return "yd";
        case Unit.FOOT:
            return "ft";
        case Unit.INCH:
            return "in";
        case Unit.DEGREE:
            return "deg";
        case Unit.RADIAN:
            return "rad";
        case Unit.KILOGRAM:
            return "kg";
        case Unit.GRAM:
            return "g";
        case Unit.POUND:
            return "lb";
        case Unit.OUNCE:
            return "oz";
        case Unit.UNITLESS:
            return "";
    }
}

export enum LogicalOp {
    AND = "AND",
    OR = "OR"
}
