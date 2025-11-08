from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field

from onshape_api.endpoints.documents import ElementType
from onshape_api.endpoints.thumbnails import ThumbnailSize


class Library(StrEnum):
    FRC_DESIGN_LIB = "frc-design-lib"
    FTC_DESIGN_LIB = "ftc-design-lib"
    MKCAD = "mkcad"


class LibraryData(BaseModel):
    cacheVersion: int = 1
    searchDb: str | None = None
    documentOrder: list[str] = Field(default_factory=list)


class ParameterType(StrEnum):
    ENUM = "BTMConfigurationParameterEnum-105"
    QUANTITY = "BTMConfigurationParameterQuantity-1826"
    BOOLEAN = "BTMConfigurationParameterBoolean-2550"
    STRING = "BTMConfigurationParameterString-872"


def get_parameter_type_name(parameter_type: ParameterType) -> str:
    return parameter_type.name


class Configuration(BaseModel):
    parameters: list[ConfigurationParameter]

    model_config = ConfigDict(extra="forbid")


class BaseConfigurationParameter(BaseModel):
    condition: VisibilityCondition | None = None
    name: str
    id: str


class EnumConfigurationParameter(BaseConfigurationParameter):
    type: Literal[ParameterType.ENUM] = ParameterType.ENUM
    default: str
    options: list[EnumOption] = Field(default_factory=list)
    optionConditions: list[OptionVisibilityCondition] = Field(default_factory=list)


class EnumOption(BaseModel):
    id: str
    name: str


class StringConfigurationParameter(BaseConfigurationParameter):
    type: Literal[ParameterType.STRING] = ParameterType.STRING
    default: str


class BooleanConfigurationParameter(BaseConfigurationParameter):
    type: Literal[ParameterType.BOOLEAN] = ParameterType.BOOLEAN
    default: Literal["true", "false"]


class QuantityConfigurationParameter(BaseConfigurationParameter):
    type: Literal[ParameterType.QUANTITY] = ParameterType.QUANTITY
    default: str
    quantityType: QuantityType
    unit: Unit
    defaultValue: float
    min: float
    max: float


ConfigurationParameter = Annotated[
    EnumConfigurationParameter
    | BooleanConfigurationParameter
    | StringConfigurationParameter
    | QuantityConfigurationParameter,
    Field(discriminator="type"),
]


class VisibilityConditionType(StrEnum):
    """Options which represent ways in which a given configuration option can be hidden."""

    LOGICAL = "BTParameterVisibilityLogical-178"
    EQUAL = "BTParameterVisibilityOnEqual-180"
    RANGE = "BTParameterVisibilityInRange-2980"
    NONE = "BTParameterVisibilityCondition-177"
    """Note: NONE is abstracted from the client."""


class LogicalOp(StrEnum):
    AND = "AND"
    OR = "OR"


class LogicalCondition(BaseModel):
    type: Literal[VisibilityConditionType.LOGICAL] = VisibilityConditionType.LOGICAL
    operation: LogicalOp
    children: list[VisibilityCondition]


class EqualCondition(BaseModel):
    type: Literal[VisibilityConditionType.EQUAL] = VisibilityConditionType.EQUAL
    id: str
    value: str


class RangeCondition(BaseModel):
    type: Literal[VisibilityConditionType.RANGE] = VisibilityConditionType.RANGE
    id: str
    start: str
    end: str


VisibilityCondition = Annotated[
    LogicalCondition | EqualCondition | RangeCondition, Field(discriminator="type")
]


class OptionConditionType(StrEnum):
    LIST = "BTEnumOptionVisibilityForList-1613"
    RANGE = "BTEnumOptionVisibilityForRange-4297"


class ListOptionVisibilityCondition(BaseModel):
    type: Literal[OptionConditionType.LIST] = OptionConditionType.LIST
    controlledOptions: list[str]
    condition: VisibilityCondition | None


class RangeOptionVisibilityCondition(BaseModel):
    type: Literal[OptionConditionType.RANGE] = OptionConditionType.RANGE
    start: str
    end: str
    condition: VisibilityCondition | None


OptionVisibilityCondition = Annotated[
    ListOptionVisibilityCondition | RangeOptionVisibilityCondition,
    Field(discriminator="type"),
]


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


class Vendor(StrEnum):
    AM = "AM"
    LAI = "LAI"
    MCM = "MCM"
    REDUX = "Redux"
    REV = "REV"
    SDS = "SDS"
    SWYFT = "SWYFT"
    TTB = "TTB"
    VEX = "VEX"
    WCP = "WCP"


def get_vendor_name(vendor: Vendor) -> str:
    match vendor:
        case Vendor.AM:
            return "AndyMark"
        case Vendor.LAI:
            return "Last Anvil Innovations"
        case Vendor.MCM:
            return "McMaster-Carr"
        case Vendor.REDUX:
            return "Redux Robotics"
        case Vendor.REV:
            return "REV Robotics"
        case Vendor.SDS:
            return "Swerve Drive Specialties"
        case Vendor.SWYFT:
            return "SWYFT"
        case Vendor.TTB:
            return "The Thrifty Bot"
        case Vendor.VEX:
            return "VEXpro"
        case Vendor.WCP:
            return "West Coast Products"


# def default_if_none(default):
#     def validator(cls, v):
#         return v if v is not None else default

#     return validator


class Element(BaseModel):
    name: str
    vendors: list[Vendor] = Field(default_factory=list)
    elementType: ElementType
    documentId: str
    instanceId: str
    microversionId: str
    isVisible: bool
    configurationId: str | None = None
    thumbbailUrls: dict[ThumbnailSize, str] | None = None


class Document(BaseModel):
    name: str
    instanceId: str
    thumbnailElementId: str
    elementOrder: list[str] = Field(default_factory=list)
    sortAlphabetically: bool


class Theme(StrEnum):
    SYSTEM = "system"
    LIGHT = "light"
    DARK = "dark"


class Settings(BaseModel):
    theme: Theme = Theme.SYSTEM
    library: Library = Library.FRC_DESIGN_LIB


class UserData(BaseModel):
    """User-specific data shared across the entire app."""

    settings: Settings = Field(default_factory=Settings)


class Favorite(BaseModel):
    defaultConfiguration: dict[str, str] | None = None


class LibraryUserData(BaseModel):
    """User-specific data for a given library."""

    favoriteOrder: list[str] = Field(default_factory=list)
    # settings: LibrarySettings
