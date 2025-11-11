from __future__ import annotations
import flask

from backend.common import connect
from backend.endpoints.cache import cacheable_route
from backend.common.database import ConfigurationParameters
from backend.common.models import (
    EqualCondition,
    ListOptionVisibilityCondition,
    LogicalCondition,
    OptionConditionType,
    OptionVisibilityCondition,
    ParameterType,
    QuantityType,
    RangeCondition,
    RangeOptionVisibilityCondition,
    Unit,
    VisibilityCondition,
    VisibilityConditionType,
    get_abbreviation,
)
from onshape_api.endpoints.documents import get_unit_info

router = flask.Blueprint("configurations", __name__)


@cacheable_route(router, "/configuration" + connect.library_route())
def get_configuration(**kwargs):
    """Returns a specific configuration.

    Returns:
        parameters: A list of configuration parameters.
    """
    document_id = connect.get_query_param("documentId")
    configuration_id = connect.get_query_param("configurationId")

    library_ref = connect.get_library_ref()
    configuration_parameters = (
        library_ref.documents.document(document_id)
        .configurations.configuration(configuration_id)
        .get()
    )
    return configuration_parameters.model_dump_json(exclude_none=True)


@router.get("/unit-info" + connect.instance_path_route())
def get_context_data(**kwargs):
    api = connect.get_api()

    instance_path = connect.get_route_instance_path()

    unit_info = get_unit_info(api, instance_path)
    units = unit_info["defaultUnits"]["units"]

    angle_unit = get_default_unit(units, QuantityType.ANGLE)
    length_unit = get_default_unit(units, QuantityType.LENGTH)

    return {
        "angleUnit": angle_unit,
        "lengthUnit": length_unit,
        "anglePrecision": unit_info["unitsDisplayPrecision"][angle_unit],
        "lengthPrecision": unit_info["unitsDisplayPrecision"][length_unit],
        "realPrecision": 3,  # Always 3 to match Onshape since there's no config for real numbers
    }


def get_default_unit(units: list, quantity_type: QuantityType) -> Unit:
    return next(unit["value"] for unit in units if unit["key"] == quantity_type)


def parse_option_visibility_conditions(
    onshape_option_conditions: dict | None,
) -> list[OptionVisibilityCondition]:
    if onshape_option_conditions == None:
        return []  # Should never happen

    option_conditions = onshape_option_conditions["visibilityConditions"]
    results = []
    for option_condition in option_conditions:
        condition = parse_visibility_condition(option_condition["condition"])
        if condition == None:
            raise ValueError(
                "An enum option visibility condition is mssing a valid visibility condition"
            )

        if option_condition["btType"] == OptionConditionType.LIST:
            results.append(
                ListOptionVisibilityCondition(
                    controlledOptions=option_condition["controlledOptions"],
                    condition=condition,
                )
            )
        elif option_condition["btType"] == OptionConditionType.RANGE:
            range = option_condition["controlledRange"]
            results.append(
                RangeOptionVisibilityCondition(
                    start=range["start"],
                    end=range["end"],
                    condition=condition,
                )
            )

    return results


def parse_visibility_condition(
    onshape_condition: dict | None,
) -> VisibilityCondition | None:
    """Transforms a visibility condition on an Onshape configuration into a valid VisibilityCondition."""
    if onshape_condition == None:
        return None

    condition_type: VisibilityConditionType = onshape_condition["btType"]
    if condition_type == VisibilityConditionType.NONE:
        return None

    if condition_type == VisibilityConditionType.LOGICAL:
        conditions = [
            parse_visibility_condition(child) for child in onshape_condition["children"]
        ]
        return LogicalCondition(
            operation=onshape_condition["operation"],
            children=[condition for condition in conditions if condition != None],
        )
    elif condition_type == VisibilityConditionType.EQUAL:
        return EqualCondition(
            id=onshape_condition["parameterId"],
            value=onshape_condition["value"],
        )
    elif condition_type == VisibilityConditionType.RANGE:
        option_range = onshape_condition["optionRange"]
        return RangeCondition(
            id=onshape_condition["parameterId"],
            start=option_range["start"],
            end=option_range["end"],
        )

    return None


# def evaluate_condition(
#     condition: VisibilityCondition | None,
#     configuration: dict[str, str],
#     parameters: list[ConfigurationParameter],
# ) -> bool:
#     if condition is None:
#         return True

#     if condition.type == VisibilityConditionType.LOGICAL:
#         if condition.operation == LogicalOp.AND:
#             return all(
#                 evaluate_condition(child, configuration, parameters)
#                 for child in condition.children
#             )
#         else:
#             return any(
#                 evaluate_condition(child, configuration, parameters)
#                 for child in condition.children
#             )

#     elif condition.type == VisibilityConditionType.EQUAL:
#         return configuration.get(condition.id) == condition.value

#     elif condition.type == VisibilityConditionType.RANGE:
#         parameter = next(
#             (parameter for parameter in parameters if parameter.id == condition.id),
#             None,
#         )
#         if parameter == None:
#             raise ValueError(
#                 "Visibility condition does not target a valid enum parameter."
#             )
#         elif parameter.type != ParameterType.ENUM:
#             raise ValueError(
#                 "Visibility condition does not target a valid enum parameter."
#             )

#         option_ids = [option.id for option in parameter.options]
#         start_index = option_ids.index(condition.start)
#         end_index = option_ids.index(condition.end)
#         return (
#             configuration.get(condition.id) in option_ids[start_index : end_index + 1]
#         )

#     return True


def parse_onshape_configuration(onshape_configuration: dict) -> ConfigurationParameters:
    """Parses an Onshape configuration into a normalized configuration which can be stored in the database."""
    parameters = []
    for parameter in onshape_configuration["configurationParameters"]:
        onshape_config_type = parameter["btType"]
        result = {
            "id": parameter["parameterId"],
            "name": parameter["parameterName"],
            "type": onshape_config_type,
            "condition": parse_visibility_condition(parameter["visibilityCondition"]),
        }

        if onshape_config_type == ParameterType.ENUM:
            result["default"] = parameter["defaultValue"]
            result["options"] = [
                {"id": option["option"], "name": option["optionName"]}
                for option in parameter["options"]
            ]
            result["optionConditions"] = parse_option_visibility_conditions(
                parameter["enumOptionVisibilityConditions"]
            )
        elif onshape_config_type == ParameterType.BOOLEAN:
            # Convert to "true" or "false" for simplicity
            result["default"] = str(parameter["defaultValue"]).lower()
        elif onshape_config_type == ParameterType.STRING:
            result["default"] = parameter["defaultValue"]
        elif onshape_config_type == ParameterType.QUANTITY:
            quantity_type = parameter["quantityType"]
            range = parameter["rangeAndDefault"]

            unit: Unit = range["units"]

            val = range["defaultValue"]
            # Convert float to int if it's an int so we don't get a trailing 0
            if isinstance(val, float) and val == int(val):
                val = int(val)

            if unit == Unit.UNITLESS:
                default = str(val)
            else:
                default = f"{val} {get_abbreviation(unit)}"

            result.update(
                {
                    "quantityType": quantity_type,
                    "default": default,
                    # Leave as integer or float values for easier comparisons
                    "defaultValue": val,
                    "min": range["minValue"],
                    "max": range["maxValue"],
                    "unit": unit,  # empty string for real and integer
                }
            )

        parameters.append(result)

    return ConfigurationParameters(parameters=parameters)
