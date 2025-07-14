from onshape_api.paths.doc_path import ElementPath, InstancePath


def make_name_to_path_map(
    elements: list[dict], document_path: InstancePath
) -> dict[str, ElementPath]:
    """Constructs a mapping of document names to their paths.

    Can be used on the responses from certain endpoints.
    """
    return dict(
        (
            element["name"],
            ElementPath.from_path(document_path, element["id"]),
        )
        for element in elements
    )


# red_color = "\033[91m"
# end_color = "\033[0m"

# configure the logging module
# config = {
#     "version": 1,
#     "disable_existing_loggers": False,
#     "formatters": {
#         "stdout": {
#             "format": "[%(levelname)s]: %(asctime)s - %(message)s",
#             "datefmt": "%x %X",
#         },
#         "stderr": {
#             "format": red_color
#             + "[%(levelname)s]: %(asctime)s - %(message)s"
#             + end_color,
#             "datefmt": "%x %X",
#         },
#     },
#     "handlers": {
#         "stdout": {
#             "class": "logging.StreamHandler",
#             "level": "DEBUG",
#             "formatter": "stdout",
#         },
#         "stderr": {
#             "class": "logging.StreamHandler",
#             "level": "ERROR",
#             "formatter": "stderr",
#         },
#     },
#     "loggers": {
#         "info": {"handlers": ["stdout"], "level": "INFO", "propagate": True},
#         "error": {"handlers": ["stderr"], "level": "ERROR", "propagate": False},
#     },
# }

# # Configure logger
# dictConfig(config)
