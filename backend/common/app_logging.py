from enum import StrEnum
import logging
from logging import Handler, LogRecord
import pprint
import google.cloud.logging as cloud_logging


from backend.common import env
from backend.common.database import (
    ConfigurationParameters,
)
from backend.common.env import IS_PRODUCTION, VERBOSE_LOGGING

from backend.common.models import ParameterType, get_parameter_type_name
from onshape_api.api.onshape_logger import ONSHAPE_LOGGER
from onshape_api.endpoints.documents import ElementType

APP_LOGGER = logging.getLogger("app")

# werkzeug is the api library used by flask
FLASK_LOGGER = logging.getLogger("werkzeug")
# Prevent propagation (and double logging) to the root logger
FLASK_LOGGER.propagate = False

CLOUD_LOGGER = logging.getLogger("cloud")
CLOUD_LOGGER.setLevel(logging.INFO)
CLOUD_LOGGER.propagate = False


class CloudLoggingDevFormatter(logging.Formatter):
    """AI generated formatter to display the json_fields attribute in dev."""

    def format(self, record: LogRecord) -> str:
        # Let the normal formatter build the base message
        base_msg = super().format(record)

        # Pull out json_fields if present
        if hasattr(record, "json_fields"):
            pretty = pprint.pformat(record.json_fields, compact=True, width=80)  # type: ignore
            return f"{base_msg}\n{pretty}"

        return base_msg


if env.IS_PRODUCTION:
    client = cloud_logging.Client()
    # Creates a CloudLoggingHandler
    handler: Handler = client.get_default_handler(name="frc-design-app-data")
    CLOUD_LOGGER.addHandler(handler)
else:
    handler = logging.StreamHandler()
    formatter = CloudLoggingDevFormatter()
    handler.setFormatter(formatter)
    CLOUD_LOGGER.addHandler(handler)
    CLOUD_LOGGER.propagate = False


def set_logging_level(logger: logging.Logger):
    """Sets the logging level of a given logger based on the value of the VERBOSE_LOGGING environment variable."""
    if not IS_PRODUCTION and VERBOSE_LOGGING:
        logger.setLevel(logging.DEBUG)
    else:
        logger.setLevel(logging.ERROR)


set_logging_level(APP_LOGGER)
set_logging_level(ONSHAPE_LOGGER)
set_logging_level(FLASK_LOGGER)


class LogType(StrEnum):
    APP_OPENED = "App opened"
    PART_INSERTED = "Part inserted"
    SEARCH = "Search"


def make_log_extra(log_data: dict | None = None) -> dict:
    if log_data == None:
        log_data = {}
    # Hardcode source field so we can route app logs to the appropriate bucket
    log_data["source"] = "frc-design-app-data"
    return {"json_fields": log_data}


def log_app_opened(user_id: str):
    log_data = {"userId": user_id}
    CLOUD_LOGGER.info(LogType.APP_OPENED, extra=make_log_extra(log_data))


def build_config_array(
    configuration: dict[str, str],
    configuration_parameters: ConfigurationParameters | None,
) -> list:
    if configuration_parameters == None:
        raise ValueError("Configuration parameters must be passed.")

    config_array = []
    for id, value in configuration.items():
        config_parameter = next(
            parameter
            for parameter in configuration_parameters.parameters
            if parameter.id == id
        )
        if config_parameter == None:
            continue

        config_dict = {
            "name": config_parameter.name,
            "type": get_parameter_type_name(config_parameter.type),
            "id": id,
            "value": value,
        }
        if config_parameter.type == ParameterType.ENUM:
            option_name = next(
                option.name for option in config_parameter.options if option.id == value
            )
            if option_name != None:
                config_dict["value"] = option_name

        config_array.append(config_dict)
    return config_array


def log_part_inserted(
    element_id: str,
    name: str,
    target_element_type: ElementType,
    user_id: str,
    is_favorite: bool,
    version: dict,
    configuration: dict[str, str] | None = None,
    configuration_parameters: ConfigurationParameters | None = None,
):
    """Logs adding an element to an assembly or part studio."""
    log_data = {
        "name": name,
        "elementId": element_id,
        "userId": user_id,
        "version": {
            "createdAt": version["createdAt"],
            "id": version["id"],
            "name": version["name"],
        },
        "targetElementType": str(target_element_type),
        "isFavorite": is_favorite,
    }
    if configuration != None:
        log_data["configuration"] = build_config_array(
            configuration, configuration_parameters
        )
    CLOUD_LOGGER.info(LogType.PART_INSERTED, extra=make_log_extra(log_data))


def log_search():
    CLOUD_LOGGER.info(LogType.SEARCH, extra=make_log_extra())
