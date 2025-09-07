from __future__ import annotations
from enum import StrEnum
from typing import Annotated, Literal
import flask
from pydantic import BaseModel, ConfigDict, Field

from backend.common import connect, env
from backend.common.backend_exceptions import ClientException


class OnshapeConfigurationType(StrEnum):
    ENUM = "BTMConfigurationParameterEnum-105"
    QUANTITY = "BTMConfigurationParameterQuantity-1826"
    BOOLEAN = "BTMConfigurationParameterBoolean-2550"
    STRING = "BTMConfigurationParameterString-872"


class ConfigurationType(StrEnum):
    """The type of each configuration parameter. Stored inside the database."""

    ENUM = "ENUM"
    QUANTITY = "QUANTITY"
    BOOLEAN = "BOOLEAN"
    STRING = "STRING"


configuration_type_mapping = {
    OnshapeConfigurationType.ENUM: ConfigurationType.ENUM,
    OnshapeConfigurationType.QUANTITY: ConfigurationType.QUANTITY,
    OnshapeConfigurationType.BOOLEAN: ConfigurationType.BOOLEAN,
    OnshapeConfigurationType.STRING: ConfigurationType.STRING,
}


def get_configuration_type(config_type: OnshapeConfigurationType) -> ConfigurationType:
    return configuration_type_mapping[config_type]


class Configuration(BaseModel):
    parameters: list[ConfigurationParameter]

    model_config = ConfigDict(extra="forbid")


class BaseConfigurationParameter(BaseModel):
    visibilityCondition: VisibilityCondition | None
    name: str
    id: str


class EnumConfigurationParameter(BaseConfigurationParameter):
    type: Literal[ConfigurationType.ENUM]
    default: str
    options: dict[str, str]
    optionVisibilityConditions: list[OptionVisibilityCondition]


class StringConfigurationParameter(BaseConfigurationParameter):
    type: Literal[ConfigurationType.STRING]
    default: str


class BooleanConfigurationParameter(BaseConfigurationParameter):
    type: Literal[ConfigurationType.BOOLEAN]
    default: bool


class QuantityConfigurationParameter(BaseConfigurationParameter):
    type: Literal[ConfigurationType.QUANTITY]
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


class ConditionType(StrEnum):
    LOGICAL = "LOGICAL"
    EQUAL = "EQUAL"


class LogicalOp(StrEnum):
    AND = "AND"
    OR = "OR"


class LogicalCondition(BaseModel):
    type: Literal[ConditionType.LOGICAL] = ConditionType.LOGICAL
    operation: LogicalOp
    children: list[VisibilityCondition]


class EqualCondition(BaseModel):
    type: Literal[ConditionType.EQUAL] = ConditionType.EQUAL
    id: str
    values: list[str]


VisibilityCondition = Annotated[
    LogicalCondition | EqualCondition, Field(discriminator="type")
]


class OptionVisibilityCondition(BaseModel):
    controlledOptions: list[str]
    visibilityCondition: VisibilityCondition


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


router = flask.Blueprint("configurations", __name__)


@router.get("/configuration/<configuration_id>")
def get_configuration(configuration_id: str):
    """Returns a specific configuration.

    Returns:
        parameters: A list of configuration parameters.
    """
    db = connect.get_db()
    configuration = db.configurations.document(configuration_id).get().to_dict()

    if not env.IS_PRODUCTION:
        Configuration.model_validate(configuration)

    if configuration == None:
        raise ClientException(
            f"Failed to find configuration with id {configuration_id}"
        )
    return configuration


class OnshapeOptionConditionType(StrEnum):
    """Options which define what specific enum options a condition will show."""

    LIST = "BTEnumOptionVisibilityForList-1613"
    RANGE = "BTEnumOptionVisibilityForRange-4297"


def parse_option_visibility_conditions(
    enum_option_visibility_conditions: dict | None, enum_option_ids: list[str]
) -> list[OptionVisibilityCondition]:
    if enum_option_visibility_conditions == None:
        return []  # Should never happen

    results = []
    option_conditions = enum_option_visibility_conditions["visibilityConditions"]
    for option_condition in option_conditions:
        result = {
            "type": option_condition["btType"],
            "visibilityCondition": parse_visibility_condition(
                option_condition["condition"], enum_option_ids
            ),
        }
        if result["type"] == OnshapeOptionConditionType.LIST:
            result["controlledOptions"] = option_condition["controlledOptions"]
        elif result["type"] == OnshapeOptionConditionType.RANGE:
            range = option_condition["controlledRange"]
            start_index = enum_option_ids.index(range["start"])
            end_index = enum_option_ids.index(range["end"])
            result["controlledOptions"] = enum_option_ids[start_index : end_index + 1]

        results.append(OptionVisibilityCondition.model_validate(result))

    return results


class OnshapeVisibilityConditionType(StrEnum):
    """Options which represent ways in which a given configuration option can be hidden."""

    LOGICAL = "BTParameterVisibilityLogical-178"
    EQUAL = "BTParameterVisibilityOnEqual-180"
    RANGE = "BTParameterVisibilityInRange-2980"
    NONE = "BTParameterVisibilityCondition-177"


def parse_visibility_condition(
    visibility_condition: dict | None, enum_option_ids: list[str] | None
) -> VisibilityCondition | None:
    """Transforms a visibility condition on an Onshape configuration into a normalized condition_dict."""
    if visibility_condition == None:
        return None

    condition_type: OnshapeVisibilityConditionType = visibility_condition["btType"]
    if condition_type == OnshapeVisibilityConditionType.NONE:
        return None

    if condition_type == OnshapeVisibilityConditionType.LOGICAL:
        conditions = [
            parse_visibility_condition(child, enum_option_ids)
            for child in visibility_condition["children"]
        ]
        return LogicalCondition(
            operation=visibility_condition["operation"],
            children=[condition for condition in conditions if condition != None],
        )
    elif condition_type == OnshapeVisibilityConditionType.EQUAL:
        return EqualCondition(
            id=visibility_condition["parameterId"],
            values=[visibility_condition["value"]],
        )
    elif condition_type == OnshapeVisibilityConditionType.RANGE:
        if enum_option_ids == None:
            raise ValueError("Missing required option")

        option_range = visibility_condition["optionRange"]
        start_index = enum_option_ids.index(option_range["start"])
        end_index = enum_option_ids.index(option_range["end"])
        valid_option_ids = enum_option_ids[start_index : end_index + 1]

        return EqualCondition(
            id=visibility_condition["parameterId"], values=valid_option_ids
        )

    return None


def parse_onshape_configuration(onshape_configuration: dict) -> Configuration:
    """Parses an Onshape configuration into a normalized configuration which can be stored in the database."""
    parameters = []
    for parameter in onshape_configuration["configurationParameters"]:
        onshape_config_type = parameter["btType"]
        result = {
            "id": parameter["parameterId"],
            "name": parameter["parameterName"],
            "type": get_configuration_type(onshape_config_type),
        }

        enum_option_ids = None
        if onshape_config_type == OnshapeConfigurationType.ENUM:
            result["default"] = parameter["defaultValue"]
            enum_options = {
                option["option"]: option["optionName"]
                for option in parameter["options"]
            }
            enum_option_ids = list(enum_options.keys())
            result["options"] = enum_options
            result["optionVisibilityConditions"] = parse_option_visibility_conditions(
                parameter["enumOptionVisibilityConditions"], enum_option_ids
            )
        elif onshape_config_type == OnshapeConfigurationType.BOOLEAN:
            # Convert to "true" or "false" for simplicity
            result["default"] = str(parameter["defaultValue"]).lower()
        elif onshape_config_type == OnshapeConfigurationType.STRING:
            result["default"] = parameter["defaultValue"]
        elif onshape_config_type == OnshapeConfigurationType.QUANTITY:
            quantity_type = parameter["quantityType"]
            range = parameter["rangeAndDefault"]

            unit: Unit = range["units"]
            default = f"{range["defaultValue"]} {get_abbreviation(unit)}"
            result.update(
                {
                    "quantityType": quantity_type,
                    "default": default,
                    "min": range["minValue"],
                    "max": range["maxValue"],
                    "unit": range["units"],  # empty string for real and integer
                }
            )

        result["visibilityCondition"] = parse_visibility_condition(
            parameter["visibilityCondition"], enum_option_ids
        )

        parameters.append(result)

    return Configuration(parameters=parameters)
