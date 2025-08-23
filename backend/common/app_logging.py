import logging

from backend.common.env import IS_PRODUCTION, VERBOSE_LOGGING
from onshape_api.api.onshape_logger import ONSHAPE_LOGGER

APP_LOGGER = logging.getLogger("app")
# werkzeug is the api library used by flask
FLASK_LOGGER = logging.getLogger("werkzeug")

if IS_PRODUCTION:
    logging.disable()


def set_logging_level(logger: logging.Logger):
    """Sets the logging level of a given logger based on the value of the VERBOSE_LOGGING environment variable."""
    if VERBOSE_LOGGING:
        logger.setLevel(logging.DEBUG)
    else:
        logger.setLevel(logging.ERROR)


set_logging_level(APP_LOGGER)
set_logging_level(ONSHAPE_LOGGER)
set_logging_level(FLASK_LOGGER)
