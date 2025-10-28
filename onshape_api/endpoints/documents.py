import enum
from typing import Iterable, override

from onshape_api.assertions import (
    assert_instance_type,
    assert_workspace,
)
from onshape_api.endpoints.versions import get_latest_version
from onshape_api.api.api_base import Api
from onshape_api.paths.api_path import api_path
from onshape_api.paths.instance_type import (
    InstanceType,
)
from onshape_api.paths.doc_path import (
    DocumentPath,
    InstancePath,
    ElementPath,
)
from onshape_api.paths.instance_type import get_instance_type_key
from onshape_api.utils.str_utils import to_json


def get_document(api: Api, document_path: DocumentPath) -> dict:
    """Retrieves a given document's metadata."""
    return api.get(
        api_path("documents", document_path, DocumentPath, skip_document_d=True)
    )


def create_new_workspace(
    api: Api, document_path: DocumentPath, name: str, description: str | None = None
) -> dict:
    """Creates a new workspace in a given document."""
    body = {"name": name}
    if description != None:
        body["description"] = description
    return api.post(
        api_path("documents", document_path, DocumentPath, "workspaces"), body=body
    )


def copy_workspace(
    api: Api, instance_path: InstancePath, new_name: str, is_public: bool = False
) -> dict:
    assert_workspace(instance_path)
    path = f"/documents/{instance_path.document_id}/workspaces/{instance_path.instance_id}/copy"
    body = {"isPublic": is_public, "newName": new_name}
    return api.post(path, body)


def create_new_workspace_from_instance(
    api: Api, path: InstancePath, name: str, description: str | None = None
) -> dict:
    """Creates a new workspace in a given document."""
    key = get_instance_type_key(path.instance_type)
    body = {"name": name, key: path.instance_id}
    if description != None:
        body["description"] = description
    return api.post(api_path("documents", path, DocumentPath, "workspaces"), body=body)


def delete_workspace(api: Api, workspace_path: InstancePath) -> dict:
    """Deletes a workspace."""
    assert_instance_type(workspace_path, InstanceType.WORKSPACE)
    return api.delete(
        api_path(
            "documents",
            workspace_path,
            DocumentPath,
            "workspaces",
            workspace_path.instance_id,
        )
    )


def delete_document(api: Api, document_path: DocumentPath) -> dict:
    """Deletes an entire document."""
    return api.delete(f"/documents/{document_path.document_id}")


class ElementType(enum.StrEnum):
    """Describes possible element (tab) types in a document."""

    PART_STUDIO = "PARTSTUDIO"
    ASSEMBLY = "ASSEMBLY"
    DRAWING = "DRAWING"
    FEATURE_STUDIO = "FEATURESTUDIO"
    BLOB = "BLOB"


def get_document_elements(
    api: Api,
    instance_path: InstancePath,
    element_type: ElementType | None = None,
) -> list[dict]:
    """Fetches all elements in a document.

    Args:
        element_type: The type of element (tab) to get. If None, all elements are returned.
    """
    query: dict = {"withThumbnails": False}
    if element_type != None:
        query["elementType"] = element_type

    return api.get(
        api_path("documents", instance_path, InstancePath, "elements"),
        query=query,
    )


def get_document_element(api: Api, element_path: ElementPath) -> dict | None:
    """Fetches an element in a document, or None if it doesn't exist."""
    query = {"withThumbnails": False, "elementId": element_path.element_id}
    response = api.get(
        api_path("documents", element_path, InstancePath, "elements"),
        query=query,
    )
    if len(response) == 1:
        return response[0]
    return None


def get_workspace_microversion_id(api: Api, instance_path: InstancePath) -> str:
    """Fetches the latest microversion id of a given workspace.

    Note this is the microversion associated with the workspace as a whole.
    Individual elements also have their own microversion ids which are unrelated to the workspace's.
    """
    assert_instance_type(instance_path, InstanceType.WORKSPACE, InstanceType.VERSION)
    return api.get(
        api_path("documents", instance_path, InstancePath, "currentmicroversion")
    )["microversion"]


def get_external_references(
    api: Api,
    instance_path: InstancePath,
) -> dict:
    """An undocumented OAuth only endpoint which returns all external references in a document.

    Generally speaking, this returns a list of the external workspaces referenced by each tab in the instance.
    """
    return api.get(
        api_path("documents", instance_path, InstancePath, "externalreferences")
    )


class ReferenceUpdate:
    def __init__(self, from_path: ElementPath, to_path: ElementPath) -> None:
        self.from_path = from_path
        self.to_path = to_path

    def __str__(self) -> str:
        return to_json(self.to_api_object())

    def to_api_object(self) -> dict:
        return {
            "fromReference": ElementPath.to_api_object(self.from_path),
            "toReference": ElementPath.to_api_object(self.to_path),
        }


class VersionUpdate(ReferenceUpdate):
    def __init__(self, old_reference_path: ElementPath, version_id: str) -> None:
        self.old_reference_path = old_reference_path
        self.version_id = version_id

    @override
    def to_api_object(self) -> dict:
        to_reference = ElementPath.copy(self.old_reference_path)
        to_reference.instance_id = self.version_id
        return {
            "fromReference": ElementPath.to_api_object(self.old_reference_path),
            "toReference": ElementPath.to_api_object(to_reference),
        }


def update_to_latest_version(
    api: Api,
    element_path: ElementPath,
    old_reference_path: ElementPath,
) -> None:
    """Updates all features in element_path which reference old_reference_path to the latest version.

    Specifically, all features in element_path which reference
    objects in old_reference_path are updated to use the latest version of that reference.
    """
    latest_version_id = get_latest_version(api, old_reference_path)["id"]
    update_references(
        api, element_path, [VersionUpdate(old_reference_path, latest_version_id)]
    )


def update_references(
    api: Api, element_path: ElementPath, reference_updates: Iterable[ReferenceUpdate]
) -> None:
    """Applies all reference updates to elements in element_path.

    Note this endpoint does not have any return information.
    """
    assert_workspace(element_path)
    body = {
        "referenceUpdates": [update.to_api_object() for update in reference_updates]
    }
    api.post(
        api_path("elements", element_path, ElementPath, "updatereferences"),
        body=body,
    )


def move_elements(
    api: Api,
    source_path: InstancePath,
    element_ids: Iterable[str],
    target_path: InstancePath | ElementPath,
    target_version_name: str,
) -> dict:
    """Moves one or more tabs from the source to the target."""
    assert_workspace(source_path)
    assert_workspace(target_path)
    body = {
        "elements": element_ids,
        "sourceDocumentId": source_path.document_id,
        "sourceWorkspaceId": source_path.instance_id,
        "targetDocumentId": target_path.document_id,
        "targetWorkspaceId": target_path.instance_id,
        "versionName": target_version_name,
    }
    if isinstance(target_path, ElementPath):
        body["anchorElementId"] = target_path.element_id

    return api.post(
        api_path("documents", source_path, InstancePath, "moveelement"), body
    )


def get_insertables(
    api: Api,
    instance_path: InstancePath,
    include_parts: bool = False,
    include_part_studios: bool = False,
    include_assemblies: bool = False,
    include_feature_studios: bool = False,
) -> dict:
    query = {
        "includeParts": include_parts,
        "includePartStudios": include_part_studios,
        "includeAssemblies": include_assemblies,
        "includeFeatureStudios": include_feature_studios,
    }
    return api.get(
        api_path("documents", instance_path, InstancePath, "insertables"), query=query
    )


def get_contents(
    api: Api,
    instance_path: InstancePath,
    include_thumbnails: bool = False,
) -> dict:
    query = {
        "withThumbnails": include_thumbnails,
    }
    return api.get(
        api_path("documents", instance_path, InstancePath, "contents"), query=query
    )


def get_microversion_id(api: Api, instance_path: InstancePath) -> str:
    """Returns the latest microversion of a given workspace or version."""
    return api.get(
        api_path("documents", instance_path, InstancePath, "currentmicroversion")
    )["microversion"]


def get_unit_info(api: Api, instance_path: InstancePath) -> dict:
    """Returns units and precision settings for a given document."""
    return api.get(api_path("documents", instance_path, InstancePath, "unitinfo"))
