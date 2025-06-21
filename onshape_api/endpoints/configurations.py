from __future__ import annotations
from typing import Iterable
from urllib import parse

from onshape_api.api.api_base import Api
from onshape_api.paths.api_path import api_path
from onshape_api.paths.paths import ElementPath


def get_configuration(api: Api, element_path: ElementPath):
    return api.get(api_path("elements", element_path, ElementPath, "configuration"))


def set_configuration(
    api: Api,
    element_path: ElementPath,
    parameters: list[dict] | None,
    current_configuration: list[dict] | None,
):
    body = {
        "btType": "BTConfigurationResponse-2019",
        "configurationParameters": parameters,
        "currentConfiguration": current_configuration,
    }
    return api.post(
        api_path("elements", element_path, ElementPath, "configuration"), body=body
    )


def decode_configuration(
    api: Api, element_path: ElementPath, config_string: str
) -> dict:
    """Converts a configuration string into JSON."""
    return api.get(
        api_path(
            "elements",
            element_path,
            ElementPath,
            "configurationencodings",
            end_id=config_string,
        )
    )


# def encode_configuration(
#     api: Api, element_path: ElementPath, configuration: list[dict]
# ) -> dict:
#     """Converts a configuration JSON into a string."""
#     body = {"parameters": configuration}
#     return api.post(
#         f"/elements/d/{element_path.document_id}/e/{element_path.element_id}/configurationencodings",
#         body=body,
#     )


def encode_configuration(values: dict[str, str]) -> str:
    """Encodes a configuration into a format suitable for passing to the Onshape API via a body parameter."""
    # Convert to str to handle booleans and other tomfoolery
    return ";".join(
        f"{id}={parse.quote_plus(str(value))}" for (id, value) in values.items()
    )


def encode_configuration_for_query(values: dict[str, str]) -> str:
    """Encodes a configuration into a format suitable for passing to the Onshape API via a query parameter."""
    return parse.quote_plus(";".join(f"{id}={value}" for (id, value) in values.items()))
