from typing import Iterable
import flask

from backend.common.backend_exceptions import require_permissions

from backend.common import connect, database
from onshape_api.api.api_base import Api
from onshape_api.endpoints.permissions import Permission

from flask import current_app
from onshape_api.endpoints import documents, versions
from onshape_api.paths.instance_type import InstanceType
from onshape_api.paths.paths import ElementPath, InstancePath

router = flask.Blueprint("references", __name__)


@router.post("/update-references" + connect.instance_route())
def update_references(*args, **kwargs):
    """Updates references in a given document.

    Args:
        childDocumentIds: A list of documentIds to look for when deciding what to update.
        If included, only references stemming from the specified documents will be updated.
        Otherwise, all outdated references will be updated.

    Returns:
        updatedElements: The number of tabs which had old references that were updated.
    """
    db = database.Database()
    api = connect.get_api(db)
    instance_path = connect.get_route_instance_path()
    require_permissions(api, instance_path, Permission.WRITE)
    child_document_ids = connect.get_optional_body_arg("childDocumentIds")
    if child_document_ids != None:
        for document_id in child_document_ids:
            require_permissions(api, document_id, Permission.LINK)

    updated_elements = do_update_references(api, instance_path, child_document_ids)
    return {"updatedElements": updated_elements}


def do_update_references(
    api: Api,
    instance_path: InstancePath,
    child_document_ids: Iterable[str] | None = None,
):
    """Updates all references from elements in instance_path to any document with child_document_ids to point to the latest version of that reference."""
    refs = documents.get_external_references(api, instance_path)
    external_refs: dict = refs["elementExternalReferences"]

    # Maps documentIds to their latest versionId
    latest_versions: list = refs["latestVersions"]
    latest_version_dict = {}
    for latest_version in latest_versions:
        latest_version_dict[latest_version["documentId"]] = latest_version["id"]

    # For some reason running this asynchronously causes problems...
    updated_elements = 0
    for element_id, paths in external_refs.items():
        target_path = ElementPath.from_path(instance_path, element_id)
        for path in paths:
            if not path["isOutOfDate"]:
                continue
            document_id = path["documentId"]
            if child_document_ids != None:
                if document_id not in child_document_ids:
                    continue
            # References are always to external versions
            current_instance_path = InstancePath(
                document_id, path["id"], InstanceType.VERSION
            )

            reference_updates = []
            for referenced_element in path["referencedElements"]:
                # Runs once for each tab and each outdated document reference
                current_path = ElementPath.from_path(
                    current_instance_path, referenced_element
                )
                update = documents.VersionUpdate(
                    current_path, latest_version_dict[current_path.document_id]
                )
                reference_updates.append(update)

            # Sometimes externalReferences returns invalid data/updates?
            try:
                documents.update_references(api, target_path, reference_updates)
                updated_elements += 1
            except:
                current_app.logger.warning("Failed to update references")
                continue

    return updated_elements


@router.post("/push-version" + connect.instance_route())
def push_version(**kwargs):
    """Creates a version, then pushes that new version to all instancesToUpdate.

    Args:
        name: The name of the version to create.
        description: The description to create.
        instancesToUpdate: A list of workspace instance objects {documentId, instanceId} to push the version to.

    Returns:
        updatedReferences: The number of tabs which had references updated.
    """
    db = database.Database()
    api = connect.get_api(db)
    curr_instance = connect.get_route_instance_path()
    require_permissions(api, curr_instance, Permission.WRITE, Permission.LINK)
    name = connect.get_body_arg("name")
    description = connect.get_optional_body_arg("description", "")
    body = connect.get_body_arg("instancesToUpdate")
    instances_to_update = [
        InstancePath(temp["documentId"], temp["instanceId"]) for temp in body
    ]
    for instance in instances_to_update:
        require_permissions(api, instance, Permission.WRITE, Permission.LINK)

    versions.create_version(api, curr_instance, name, description)

    updated_references = 0
    visited_ids = [curr_instance.document_id]
    for update_instance in instances_to_update:
        updated_references += do_update_references(api, update_instance, visited_ids)
        visited_ids.append(update_instance.document_id)
        versions.create_version(api, update_instance, name, description)

    return {"updatedReferences": updated_references}
