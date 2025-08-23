from enum import StrEnum
import re


class Vendor(StrEnum):
    AM = "AM"
    LAI = "LAI"
    MCM = "MCM"
    REDUX = "Redux"
    REV = "REV"
    SDS = "SDS"
    SWYFT = "Swyft"
    TTB = "TTB"
    VEX = "VEX"
    WCP = "WCP"


def parse_vendor(name: str) -> Vendor | None:
    match = re.search(r"\((\w+)\)$", name)
    if not match:
        return None
    vendor_str = match.group(1)
    return next((vendor for vendor in Vendor if vendor == vendor_str), None)


class ConfigurationType(StrEnum):
    ENUM = "BTMConfigurationParameterEnum-105"
    QUANTITY = "BTMConfigurationParameterQuantity-1826"
    BOOLEAN = "BTMConfigurationParameterBoolean-2550"
    STRING = "BTMConfigurationParameterString-872"


class ParameterType(StrEnum):
    ENUM = "BTMParameterEnum-145"
    QUANTITY = "BTMParameterQuantity-147"
    BOOLEAN = "BTMParameterBoolean-144"
    STRING = "BTMParameterString-149"


type_mapping = {
    ConfigurationType.ENUM: ParameterType.ENUM,
    ConfigurationType.QUANTITY: ParameterType.QUANTITY,
    ConfigurationType.BOOLEAN: ParameterType.BOOLEAN,
    ConfigurationType.STRING: ParameterType.STRING,
}


def config_type_to_parameter_type(config_type: ConfigurationType) -> ParameterType:
    return type_mapping[config_type]


class QuantityType(StrEnum):
    LENGTH = "LENGTH"
    ANGLE = "ANGLE"
    INTEGER = "INTEGER"
    REAL = "REAL"


class Unit(StrEnum):
    METER = "meter"
    CENTIMETER = "centimeter"
    MILLIMETER = "millimeter"
    YARD = "yard"
    FOOT = "foot"
    INCH = "inch"
    DEGREE = "degree"
    RADIAN = "radian"
    UNITLESS = ""


def get_abbreviation(unit: Unit) -> str:
    match unit:
        case Unit.METER:
            return "m"
        case Unit.CENTIMETER:
            return "cm"
        case Unit.MILLIMETER:
            return "mm"
        case Unit.YARD:
            return "yd"
        case Unit.FOOT:
            return "ft"
        case Unit.INCH:
            return "in"
        case Unit.DEGREE:
            return "deg"
        case Unit.RADIAN:
            return "rad"
        case Unit.UNITLESS:
            return ""


class ConditionType(StrEnum):
    LOGICAL = "BTParameterVisibilityLogical-178"
    EQUAL = "BTParameterVisibilityOnEqual-180"


NONE_CONDITION = "BTParameterVisibilityCondition-177"
"""Note: NONE_CONDITION is not currently exposed to the frontend."""


class LogicalOp(StrEnum):
    AND = "AND"
    OR = "OR"
