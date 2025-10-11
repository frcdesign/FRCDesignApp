"""Routes for updating the database.

Every route in this file is access controlled.
"""

from __future__ import annotations
import asyncio
from enum import StrEnum
import re
from typing import Iterator
import flask

from backend.common import connect, database
from backend.common.app_access import require_access_level
from backend.common.app_logging import log_search
from backend.endpoints.cache import cacheable_route
from backend.common.models import Element, UserData, Vendor
from backend.common.models import Document
from backend.endpoints.configurations import parse_onshape_configuration
from backend.endpoints.preserved_info import (
    PreservedInfo,
)
from backend.endpoints.user_data import delete_favorites
from onshape_api.api.api_base import Api
from onshape_api.endpoints import documents
from onshape_api.endpoints.configurations import get_configuration
from onshape_api.endpoints.documents import ElementType
from onshape_api.endpoints.versions import get_latest_version_path
from onshape_api.paths.doc_path import (
    DocumentPath,
    ElementPath,
    InstancePath,
)
from onshape_api.paths.instance_type import InstanceType

router = flask.Blueprint("documents", __name__)


@cacheable_route(router, "/documents")
def get_documents(**kwargs):
    """Returns a list of the top level documents to display to the user."""
    db = connect.get_db()

    documents: dict[str, dict] = {}

    for doc_ref in db.documents.stream():
        document = Document.model_validate(doc_ref.to_dict())
        document_id = doc_ref.id

        document_obj = document.model_dump(exclude_none=True)
        document_obj["id"] = document_id
        # Make it a valid InstancePath on the frontend
        document_obj["instanceType"] = InstanceType.VERSION
        document_obj["documentId"] = document_id

        documents[document_id] = document_obj

    return {"documents": documents}


@cacheable_route(router, "/elements")
def get_elements(**kwargs):
    """Returns a list of the top level elements to display to the user."""
    db = connect.get_db()
    elements: dict[str, dict] = {}

    for element_ref in db.elements.stream():
        element_id = element_ref.id
        element = Element.model_validate(element_ref.to_dict())

        element_obj = element.model_dump(exclude_none=True)
        element_obj["id"] = element_id
        # Add instanceType and elementId so it's a valid ElementPath on the frontend
        element_obj["instanceType"] = InstanceType.VERSION
        element_obj["elementId"] = element_id

        elements[element_id] = element_obj

    return {"elements": elements}


def parse_vendor(name: str) -> Vendor | None:
    match = re.search(r"\((\w+)\)$", name)
    if not match:
        return None
    vendor_str = match.group(1)
    return next((vendor for vendor in Vendor if vendor == vendor_str), None)


def save_element(
    db: database.Database,
    api: Api,
    version_path: InstancePath,
    onshape_element: dict,
    preserved_info: PreservedInfo,
) -> str:
    """
    Parameters:
        element: A part studio or assembly returned by the /elements endpoint.
    """

    element_type: ElementType = onshape_element["elementType"]
    element_name = onshape_element["name"]  # Use the name of the tab
    element_id = onshape_element["id"]

    path = ElementPath.from_path(version_path, element_id)

    onshape_configuration = get_configuration(api, path)
    configuration_id = None
    if len(onshape_configuration["configurationParameters"]) > 0:
        configuration = parse_onshape_configuration(onshape_configuration)
        # Re-use element db id since configurations can't be shared
        db.configurations.document(element_id).set(configuration.model_dump())
        configuration_id = element_id

    preserved_element = preserved_info.get_element(element_id)
    db.elements.document(element_id).set(
        Element(
            name=element_name,
            vendor=parse_vendor(element_name),
            elementType=element_type,
            documentId=version_path.document_id,
            instanceId=version_path.instance_id,
            microversionId=onshape_element["microversionId"],
            configurationId=configuration_id,
            isVisible=preserved_element.isVisible,
        ).model_dump()
    )
    return element_id


class EntryType(StrEnum):
    GROUP = "BTElementGroup-1458"
    ELEMENT = "BTDocumentElementReference-2484"


def get_ordered_element_ids(contents: dict) -> Iterator[str]:
    """Returns a list of element_ids in the same order as they are in an Onshape document."""
    for entry in contents["folders"]["groups"]:
        yield from traverse_entry(entry)


def traverse_entry(entry: dict) -> Iterator[str]:
    entry_type = entry["btType"]
    if entry_type == EntryType.GROUP:
        for entry in entry["groups"]:
            yield from traverse_entry(entry)
    elif entry_type == EntryType.ELEMENT:
        yield entry["elementId"]


async def save_document(
    api: Api,
    db: database.Database,
    version_path: InstancePath,
    preserved_info: PreservedInfo | None = None,
) -> int:
    """Loads all of the elements of a given document into the database."""
    # Fill in PreservedInfo to get access to defaults
    if preserved_info == None:
        preserved_info = PreservedInfo()

    contents = await asyncio.to_thread(documents.get_contents, api, version_path)

    valid_elements = [
        onshape_element
        for onshape_element in contents["elements"]
        if onshape_element["elementType"]
        in [ElementType.ASSEMBLY, ElementType.PART_STUDIO]
    ]
    valid_ids = set(element["id"] for element in valid_elements)

    ordered_element_ids = [
        element_id
        for element_id in get_ordered_element_ids(contents)
        if element_id in valid_ids
    ]

    save_element_operations = [
        asyncio.to_thread(
            save_element, db, api, version_path, onshape_element, preserved_info
        )
        for onshape_element in valid_elements
    ]

    onshape_document = documents.get_document(api, version_path)
    thumbnail_element_id = onshape_document["documentThumbnailElementId"]
    if thumbnail_element_id == None:
        raise ValueError(
            "Document "
            + onshape_document["name"]
            + " does not have a thumbnail tab set"
        )

    document_id = version_path.document_id

    await asyncio.gather(*save_element_operations)

    preserved_document = preserved_info.get_document(document_id)
    db.documents.document(document_id).set(
        Document(
            name=onshape_document["name"],
            thumbnailElementId=thumbnail_element_id,
            instanceId=version_path.instance_id,
            elementIds=ordered_element_ids,
            sortAlphabetically=preserved_document.sortAlphabetically,
        ).model_dump()
    )
    return len(ordered_element_ids)


def preserve_info(db: database.Database) -> PreservedInfo:
    preserved_info = PreservedInfo()
    for doc_ref in db.documents.stream():
        document_id = doc_ref.id
        document_dict = doc_ref.to_dict()
        preserved_info.save_document(document_id, document_dict)

    for element_ref in db.elements.stream():
        element_id = element_ref.id
        element_dict = element_ref.to_dict()
        preserved_info.save_element(element_id, element_dict)

    return preserved_info


async def refresh_document(
    api: Api,
    db: database.Database,
    latest_version_path: InstancePath,
    preserved_info: PreservedInfo,
) -> int:
    delete_document(db, latest_version_path.document_id)
    return await save_document(api, db, latest_version_path, preserved_info)


async def reload_document(
    api: Api,
    db: database.Database,
    document_path: DocumentPath,
    reload_all: bool,
    preserved_info: PreservedInfo,
) -> int:
    latest_version_path = await asyncio.to_thread(
        get_latest_version_path, api, document_path
    )

    document = db.documents.document(document_path.document_id).get().to_dict()
    if document == None:
        # Document doesn't exist, create it immediately
        return await save_document(api, db, latest_version_path, PreservedInfo())

    if reload_all:
        return await refresh_document(api, db, latest_version_path, preserved_info)

    # Version is already saved
    if document.get("instanceId") == latest_version_path.instance_id:
        return 0

    # Refresh document
    return await refresh_document(api, db, latest_version_path, preserved_info)


@router.post("/reload-documents")
@require_access_level()
async def reload_documents(**kwargs):
    """Saves the contents of the latest versions of all documents managed by FRC Design Lib into the database."""
    db = connect.get_db()
    api = connect.get_api(db)

    reload_all = connect.get_query_bool("reloadAll", False)

    document_order = db.get_document_order()

    preserved_info = preserve_info(db)

    count = 0
    visited = set()

    operations = []
    for document_id in document_order:
        document_path = DocumentPath(document_id)
        visited.add(document_path.document_id)

        operations.append(
            reload_document(api, db, document_path, reload_all, preserved_info)
        )

    results = await asyncio.gather(*operations)
    count = sum(results)

    clean_favorites(db)

    return {"savedElements": count}


def delete_document(db: database.Database, document_id: str):
    """Deletes a document and all elements and configurations which depend on it.

    Note this does not update documentOrder or user favorites.
    """
    document = db.documents.document(document_id).get().to_dict()
    db.documents.document(document_id).delete()

    if document == None:
        return
    # Delete all children as well
    for element_id in document.get("elementIds", []):
        db.elements.document(element_id).delete()
        db.configurations.document(element_id).delete()


async def verify_db_integrity(db: database.Database) -> None:
    """Verifies document order, favorite order, and favorites integrity."""
    document_ids = set(db.documents.list_documents())

    document_order = db.get_document_order()
    document_order_ids = set(document_order)

    if document_ids != document_order_ids:
        raise ValueError("documentOrder does not match documents")

    user_data = db.user_data.stream()
    for user_data_ref in user_data:
        user_data = UserData.model_validate(user_data_ref.to_dict())

        favorite_order_ids = set(user_data.favoriteOrder)
        favorite_ids = set(user_data.favorites.keys())

        if favorite_order_ids != favorite_ids:
            raise ValueError(
                f"User {user_data_ref.id} has a favoriteOrder that does not match favorites"
            )

        for element_id in user_data.favorites.keys():
            element_ref = db.elements.document(element_id).get()
            if not element_ref.exists:
                raise ValueError(
                    f"User {user_data_ref.id} has a favorite element {element_id} that does not exist"
                )
            element = Element.model_validate(element_ref.to_dict())
            if not element.isVisible:
                raise ValueError(
                    f"User {user_data_ref.id} has a favorite element {element_id} that is not visible"
                )


def clean_favorites(db: database.Database) -> None:
    """Removes any favorites that are no longer valid."""
    for user_data_ref in db.user_data.stream():
        user_data = UserData.model_validate(user_data_ref.to_dict())
        favorite_ids = list(user_data.favorites.keys())

        modified = False
        for element_id in favorite_ids:
            element_ref = db.elements.document(element_id).get()

            invalid = element_ref.exists == False
            if not invalid:
                element = Element.model_validate(element_ref.to_dict())
                invalid = element.isVisible == False

            if invalid:
                modified = True
                user_data.favorites.pop(element_id)
                user_data.favoriteOrder = list(
                    id for id in user_data.favoriteOrder if id != element_id
                )

        if modified:
            db.set_user_data(user_data_ref.id, user_data)


@router.post("/set-visibility")
@require_access_level()
def set_visibility():
    db = connect.get_db()
    element_ids = connect.get_body_arg("elementIds")
    is_visible = connect.get_body_arg("isVisible")

    if not is_visible:
        delete_favorites(db, element_ids)

    for element_id in element_ids:
        db.elements.document(element_id).set({"isVisible": is_visible}, merge=True)
    return {"success": True}


@router.post("/set-document-sort")
@require_access_level()
def set_document_sort():
    db = connect.get_db()
    document_id = connect.get_body_arg("documentId")
    sort_alphabetically = connect.get_body_arg("sortAlphabetically")

    db.documents.document(document_id).set(
        {"sortAlphabetically": sort_alphabetically}, merge=True
    )
    return {"success": True}


@router.post("/search-result-selected")
def search_result_selected():
    """Logs that a search result was selected."""
    log_search()
    return {"success": True}
