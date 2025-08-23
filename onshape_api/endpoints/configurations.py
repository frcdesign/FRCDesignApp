from __future__ import annotations
from urllib import parse

from onshape_api.api.api_base import Api
from onshape_api.paths.api_path import api_path
from onshape_api.paths.doc_path import ElementPath


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
    api: Api, element_path: ElementPath, configuration_string: str
) -> dict[str, str]:
    """Converts a configuration string into back into a dict mapping parameter ids to arrays."""
    result = api.get(
        api_path(
            "elements",
            element_path,
            ElementPath,
            "configurationencodings",
            end_id=configuration_string,
        )
    )
    return {
        parameter["parameterId"]: parameter["parameterValue"]
        for parameter in result["parameters"]
    }


def encode_configuration(values: dict[str, str]) -> str:
    """Encodes a configuration into a string suitable for passing to the Onshape API as a body parameter."""
    # Convert to str to handle booleans and other tomfoolery
    return ";".join(
        f"{id}={str(parse.quote_plus(value))}" for (id, value) in values.items()
    )


def encode_configuration_for_query(values: dict[str, str]) -> str:
    """Encodes a configuration into a format suitable for passing to the Onshape API via a query parameter."""
    return parse.quote_plus(";".join(f"{id}={value}" for (id, value) in values.items()))
