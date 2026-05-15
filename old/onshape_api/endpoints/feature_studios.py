from typing import Any

from onshape_api.api.api_base import Api
from onshape_api.paths.api_path import api_path
from onshape_api.assertions import assert_instance_type, assert_workspace
from onshape_api.paths.instance_type import InstanceType
from onshape_api.paths.doc_path import InstancePath, ElementPath


def pull_code(
    api: Api, feature_studio_path: ElementPath, raw_response: bool = False
) -> Any:
    """Fetches code from a feature studio.

    Args:
        raw_response: True to get the entire response, False to get just the code.
    """
    response = api.get(api_path("featurestudios", feature_studio_path, ElementPath))
    return response if raw_response else response["contents"]


def push_code(api: Api, feature_studio_path: ElementPath, code: str) -> dict:
    """Sends code to the given feature studio specified by path."""
    assert_workspace(feature_studio_path)
    return api.post(
        api_path("featurestudios", feature_studio_path, ElementPath),
        body={"contents": code},
    )


def create_feature_studio(
    api: Api, instance_path: InstancePath, studio_name: str
) -> dict:
    """Creates a feature studio with the given name."""
    assert_instance_type(instance_path, InstanceType.WORKSPACE)
    return api.post(
        api_path("featurestudios", instance_path, InstancePath),
        body={"name": studio_name},
    )


def get_feature_specs(api: Api, feature_studio_path: ElementPath) -> dict:
    return api.get(
        api_path("featurestudios", feature_studio_path, ElementPath, "featurespecs")
    )


def get_feature_spec(api: Api, feature_studio_path: ElementPath) -> dict:
    """Returns the feature spec for the first custom feature in a given Feature Studio."""
    feature_specs = get_feature_specs(api, feature_studio_path)
    if len(feature_specs["featureSpecs"]) < 1:
        raise ValueError(
            "The specified feature studio did not have any custom features"
        )
    return feature_specs["featureSpecs"][0]
