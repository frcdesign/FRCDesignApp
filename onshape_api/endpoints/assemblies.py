from typing import Iterable
from urllib import parse


from onshape_api.api.api_base import Api
from onshape_api.assertions import assert_workspace
from onshape_api.endpoints.configurations import encode_configuration
from onshape_api.endpoints.documents import ElementType
from onshape_api.paths.api_path import api_path
from onshape_api.paths.doc_path import ElementPath, InstancePath


def get_assembly(
    api: Api,
    assembly_path: ElementPath,
    include_non_solids: bool = False,
    include_mate_features: bool = False,
    include_mate_connectors: bool = False,
    exclude_suppressed: bool = True,
) -> dict:
    """Retrieves information about an assembly."""
    return api.get(
        api_path("assemblies", assembly_path, ElementPath),
        query={
            "includeMateFeatures": include_mate_features,
            "includeNonSolids": include_non_solids,
            "excludeSuppressed": exclude_suppressed,
            "includeMateConnectors": include_mate_connectors,
        },
    )


def get_assembly_features(
    api: Api,
    assembly_path: ElementPath,
    feature_ids: Iterable[str] = [],
) -> dict:
    """Returns features in an assembly.

    Args:
        feature_ids: Feature ids to retrieve. If omitted, all features are returned.
    """
    query = parse.urlencode({"featureId": feature_ids}, doseq=True)
    return api.get(
        api_path("assemblies", assembly_path, ElementPath, "features"), query=query
    )


def create_assembly(api: Api, workspace_path: InstancePath, assembly_name: str) -> dict:
    """Constructs an assembly with the given name."""
    assert_workspace(workspace_path)
    return api.post(
        api_path("assemblies", workspace_path, InstancePath),
        body={"name": assembly_name},
    )


def add_element_to_assembly(
    api: Api,
    assembly_path: ElementPath,
    element_path: ElementPath,
    element_type: ElementType,
    configuration: dict[str, str] | None = None,
) -> None:
    """
    Adds the contents of an element tab to an assembly.

    Note this function uses the transformedinstances endpoint since the default insert endpoint has no return value.

    assembly_path: The path to the assembly to add to.
    element_path: The path to the element tab to insert into the assembly.
    """
    assert_workspace(assembly_path)

    instance = {}
    if configuration != None:
        instance["configuration"] = encode_configuration(configuration)

    if element_type == ElementType.ASSEMBLY:
        instance["isAssembly"] = True
    elif element_type == ElementType.PART_STUDIO:
        instance.update(
            {
                "includePartTypes": ["PARTS", "COMPOSITE_PARTS"],
                "isWholePartStudio": True,
            }
        )
    else:
        raise ValueError(
            f"The given element_type must be a part studio or assembly, got {element_type}"
        )

    instance.update(ElementPath.to_api_object(element_path))

    # Could use the transformedinstances endpoint to get a return value
    # body = {
    #     "transformGroups": [{"instances": [instance], "transform": IDENTITY_TRANSFORM}]
    # }

    # The post instances endpoint has no return value :(
    api.post(
        api_path("assemblies", assembly_path, ElementPath, "instances"),
        body=instance,
        is_json=False,
    )


def transform_instance(
    api: Api,
    assembly_path: ElementPath,
    instance_id: str,
    transform: list[int | float],
    is_relative: bool = False,
):
    """
    Args:
        is_relative: True to apply the transform relative to the instance's existing location, False to apply it relative to the assembly origin.
    """
    assert_workspace(assembly_path)
    return api.post(
        api_path("assemblies", assembly_path, ElementPath, "occurrencetransforms"),
        body={
            "isRelative": is_relative,
            "occurrences": [{"path": [instance_id]}],
            "transform": transform,
        },
    )


def add_feature(
    api: Api,
    assembly_path: ElementPath,
    feature: dict,
    feature_id: str | None = None,
) -> dict:
    """
    Args:
        feature_id: If specified, the given feature is updated rather than being created.
    """
    assert_workspace(assembly_path)
    return api.post(
        api_path(
            "assemblies",
            assembly_path,
            ElementPath,
            "features",
            feature_id=feature_id,
        ),
        body={"feature": feature},
    )


def delete_feature(api: Api, assembly_path: ElementPath, feature_id: str) -> dict:
    """Deletes a feature from an assembly."""
    assert_workspace(assembly_path)
    return api.delete(
        api_path(
            "assemblies",
            assembly_path,
            ElementPath,
            "features",
            feature_id=feature_id,
        )
    )
