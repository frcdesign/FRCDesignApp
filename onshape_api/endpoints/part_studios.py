import json

from onshape_api.api.api_base import Api
from onshape_api.assertions import assert_instance_type, assert_workspace
from onshape_api.paths.api_path import api_path
from onshape_api.paths.instance_type import InstanceType
from onshape_api.paths.doc_path import ElementPath, InstancePath


def create_part_studio(api: Api, instance_path: InstancePath, name: str) -> dict:
    """Creates a part studio in a document."""
    assert_workspace(instance_path)
    return api.post(
        api_path("partstudios", instance_path, InstancePath), body={"name": name}
    )


def evaluate_feature_script(
    api: Api, part_studio_path: ElementPath, script: str
) -> dict:
    """Evaluate a FeatureScript script against a given part studio.

    Returns the printed output of the script parsed as JSON.
    """
    result = api.post(
        api_path("partstudios", part_studio_path, ElementPath, "featurescript"),
        body={"script": script},
    )
    return json.loads(result["console"])


def add_feature(api: Api, part_studio_path: ElementPath, feature: dict):
    """Adds a feature to a part studio."""
    assert_instance_type(part_studio_path, InstanceType.WORKSPACE)

    body = {"feature": feature}

    return api.post(
        api_path("partstudios", part_studio_path, ElementPath, "features"), body=body
    )
