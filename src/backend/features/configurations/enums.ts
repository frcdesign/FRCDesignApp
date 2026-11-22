/** As Onshape sends them. */

export enum QuantityType {
    LENGTH = "LENGTH",
    ANGLE = "ANGLE",
    INTEGER = "INTEGER",
    REAL = "REAL"
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
    UNITLESS = ""
}

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
        case Unit.UNITLESS:
            return "";
    }
}

/** A document's mass unit, as Onshape names it; no configuration parameter takes one. */
export enum MassUnit {
    KILOGRAM = "kilogram",
    GRAM = "gram",
    POUND = "pound",
    OUNCE = "ounce"
}

export function getMassUnitDisplayStr(unit: MassUnit): string {
    switch (unit) {
        case MassUnit.KILOGRAM:
            return "kg";
        case MassUnit.GRAM:
            return "g";
        case MassUnit.POUND:
            return "lb";
        case MassUnit.OUNCE:
            return "oz";
    }
}

export enum LogicalOp {
    AND = "AND",
    OR = "OR"
}
