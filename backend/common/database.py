from __future__ import annotations
from enum import StrEnum
from typing import Annotated, Literal
from google.cloud import firestore
from google.cloud.firestore import CollectionReference, DocumentReference
from pydantic import BaseModel, ConfigDict, Field


class Database:
    def __init__(self, client: firestore.Client):
        self.client = client

    @property
    def sessions(self) -> CollectionReference:
        return self.client.collection("sessions")

    @property
    def documents(self) -> CollectionReference:
        return self.client.collection("documents")

    @property
    def elements(self) -> CollectionReference:
        return self.client.collection("elements")

    @property
    def configurations(self) -> CollectionReference:
        return self.client.collection("configurations")

    def get_configuration_parameters(
        self, configuration_id: str
    ) -> ConfigurationParameters:
        parameters = self.configurations.document(configuration_id).get().to_dict()
        if parameters == None:
            raise ValueError(f"Failed to find configuration with id {configuration_id}")

        return ConfigurationParameters.model_validate(parameters)

    @property
    def document_order(self) -> DocumentReference:
        # Yes, there are three layers of documentOrder...
        return self.client.collection("documentOrder").document("documentOrder")

    def get_document_order(self) -> list[str]:
        result = self.document_order.get().to_dict()
        if result == None:
            return []
        # We have to nest to satisfy Google Cloud
        return result.get("documentOrder", [])

    def set_document_order(self, order: list[str]) -> None:
        self.document_order.set({"documentOrder": order})

    def delete_document(self, document_id: str):
        """Deletes a document and all elements and configurations which depend on it."""
        document = self.documents.document(document_id).get().to_dict()
        self.documents.document(document_id).delete()

        if document == None:
            return
        # Delete all children as well
        for element_id in document.get("elementIds", []):
            self.elements.document(element_id).delete()
            self.configurations.document(element_id).delete()


def delete_collection(coll_ref: CollectionReference, batch_size=500):
    """Deletes a collection in the database."""
    if batch_size == 0:
        return

    docs = coll_ref.list_documents(page_size=batch_size)
    deleted = 0

    for doc in docs:
        doc.delete()
        deleted = deleted + 1

    if deleted >= batch_size:
        return delete_collection(coll_ref, batch_size)


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
