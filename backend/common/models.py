from __future__ import annotations

from datetime import datetime
from enum import IntEnum, StrEnum
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field

from onshape_api.api.api_base import Api
from onshape_api.endpoints import documents
from onshape_api.endpoints.documents import ElementType
from onshape_api.endpoints.thumbnails import ThumbnailSize
from onshape_api.paths.doc_path import InstancePath
from onshape_api.paths.instance_type import InstanceType


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


class ConfigurationParameters(BaseModel):
    parameters: list[ConfigurationParameter] = Field(default_factory=list)

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


class DocumentSchema(IntEnum):
    """The schema version of a document.

    Increase it to bust the Document version cache.
    """

    V1 = 1


LATEST_DOCUMENT_SCHEMA = DocumentSchema.V1


class ElementSchema(IntEnum):
    """The schema version of an element.

    Increase it to bust the Element microversion cache.
    Note the DocumentSchema also likely needs to be updated since Documents are reloaded alongside Elements.
    """

    V1 = 1


LATEST_ELEMENT_SCHEMA = ElementSchema.V1


class Element(BaseModel):
    elementSchema: ElementSchema | None = LATEST_ELEMENT_SCHEMA
    name: str
    vendors: list[Vendor] = Field(default_factory=list)
    elementType: ElementType
    documentId: str
    instanceId: str
    microversionId: str
    isVisible: bool = False
    # Whether the element is a part studio with an open composite part studio.
    isOpenComposite: bool = False
    # If the element supports insert and fasten, this is the mate connector id to use.
    fastenInfo: FastenInfo | None = None
    configurationId: str | None = None
    # Currently only TINY and STANDARD are populated
    thumbnailUrls: dict[ThumbnailSize, str] = Field(default_factory=dict)


class MateLocation(StrEnum):
    FEATURE = "Feature"
    PART = "Part"
    SUBASSEMBLY = "Subassembly"


class FastenInfo(BaseModel):
    # The id of the mate connector feature.
    mateConnectorId: str
    mateLocation: MateLocation = MateLocation.FEATURE
    # If the mate location is a child part or assembly instance, this is the path to that instance.
    path: list[str] = Field(default_factory=list)


class Document(BaseModel):
    documentSchema: DocumentSchema | None = LATEST_DOCUMENT_SCHEMA
    name: str
    # The version of the document.
    instanceId: str
    elementOrder: list[str] = Field(default_factory=list)
    sortAlphabetically: bool
    thumbnailUrls: dict[ThumbnailSize, str] = Field(default_factory=dict)
    versionInfo: VersionInfo


class VersionInfo(BaseModel):
    name: str
    createdAt: datetime


def parse_version(version_dict: dict) -> tuple[InstancePath, VersionInfo]:
    version_path = InstancePath(
        document_id=version_dict["documentId"],
        instance_id=version_dict["id"],
        instance_type=InstanceType.VERSION,
    )
    version_info = VersionInfo(
        name=version_dict["name"],
        createdAt=version_dict["createdAt"],
    )
    return version_path, version_info


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
