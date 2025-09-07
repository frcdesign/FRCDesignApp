from enum import StrEnum
import logging
from logging import Handler, LogRecord
import pprint
import google.cloud.logging as cloud_logging


from backend.common import env
from backend.common.env import IS_PRODUCTION, VERBOSE_LOGGING

from backend.endpoints.configurations import OnshapeConfigurationType
from onshape_api.api.onshape_logger import ONSHAPE_LOGGER
from onshape_api.endpoints.documents import ElementType

APP_LOGGER = logging.getLogger("app")

# werkzeug is the api library used by flask
FLASK_LOGGER = logging.getLogger("werkzeug")
# Prevent propagation (and double logging) to the root logger
FLASK_LOGGER.propagate = False

CLOUD_LOGGER = logging.getLogger("cloud")
CLOUD_LOGGER.setLevel(logging.INFO)


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


def log_app_opened(user_id: str):
    log_data = {"userId": user_id}
    CLOUD_LOGGER.info(LogType.APP_OPENED, extra={"json_fields": log_data})


def build_config_array(
    configuration: dict[str, str], configuration_parameters: dict | None = None
) -> list:
    if configuration_parameters == None:
        raise ValueError("Configuration parameters must be passed.")
    # TODO: Hide non-visible parameters
    config_array = []
    for id, value in configuration.items():
        config_parameter = configuration_parameters["key"]
        config_dict = {
            "name": config_parameter["name"],
            "type": config_parameter["type"],
            "id": id,
            "value": value,
        }
        if config_parameter["type"] == OnshapeConfigurationType.ENUM:
            # Convert from enum option id to name of option
            # Could be missing if it was, e.g., deprecated
            config_dict["value"] = config_parameter["options"].get(id)
        config_array.append(config_dict)
    return config_array


def log_part_inserted(
    element_id: str,
    name: str,
    user_id: str,
    target_element_type: ElementType,
    is_favorite: bool,
    version: dict,
    configuration: dict[str, str] | None = None,
    configuration_parameters: dict | None = None,
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
        "targetElementType": target_element_type,
        "isFavorite": is_favorite,
    }
    if configuration != None:
        log_data["configuration"] = build_config_array(
            configuration, configuration_parameters
        )
    CLOUD_LOGGER.info(LogType.PART_INSERTED, extra={"json_fields": log_data})


def log_search():
    CLOUD_LOGGER.info(LogType.SEARCH)
