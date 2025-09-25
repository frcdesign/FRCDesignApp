from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field

from backend.common import env
from backend.endpoints.backend_types import Vendor
from onshape_api.endpoints.documents import ElementType


class ParameterType(StrEnum):
    ENUM = "BTMConfigurationParameterEnum-105"
    QUANTITY = "BTMConfigurationParameterQuantity-1826"
    BOOLEAN = "BTMConfigurationParameterBoolean-2550"
    STRING = "BTMConfigurationParameterString-872"


def get_parameter_type_name(parameter_type: ParameterType) -> str:
    return parameter_type.name


class ConfigurationParameters(BaseModel):
    parameters: list[ConfigurationParameter]

    model_config = ConfigDict(extra="forbid")


class BaseConfigurationParameter(BaseModel):
    condition: VisibilityCondition | None
    name: str
    id: str


class EnumConfigurationParameter(BaseConfigurationParameter):
    type: Literal[ParameterType.ENUM] = ParameterType.ENUM
    default: str
    options: list[EnumOption]
    optionConditions: list[OptionVisibilityCondition]


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
    min: str | float
    max: str | float


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


class Element(BaseModel):
    name: str
    vendor: Vendor | None
    elementType: ElementType
    documentId: str
    instanceId: str
    microversionId: str
    # Default isVisible to true in development
    isVisible: bool | None = False if env.IS_PRODUCTION else True
    configurationId: str | None = None

    model_config = ConfigDict(extra="forbid")


class Document(BaseModel):
    name: str
    instanceId: str
    thumbnailElementId: str
    elementIds: list[str]
    sortAlphabetically: bool | None = False

    model_config = ConfigDict(extra="forbid")
