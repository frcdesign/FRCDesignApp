/**
 * Value enums Onshape emits unchanged.
 */

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

export enum LogicalOp {
    AND = "AND",
    OR = "OR"
}
