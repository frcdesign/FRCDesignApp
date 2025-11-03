"""Routes for updating the database.

Every route in this file is access controlled.
"""

from __future__ import annotations
import asyncio
from enum import StrEnum
from typing import Iterator
import flask

from backend.common import connect
from backend.common.backend_exceptions import HandledException
from backend.common.database import DocumentRef, LibraryRef
from backend.common.app_access import require_access_level
from backend.common.models import (
    Element,
)
from backend.common.models import Document
from backend.common.vendors import parse_vendors
from backend.endpoints.configurations import parse_onshape_configuration
from backend.endpoints.preserved_info import (
    PreservedInfo,
)
from onshape_api.api.api_base import Api
from onshape_api.endpoints import documents
from onshape_api.endpoints.configurations import get_configuration
from onshape_api.endpoints.documents import ElementType, get_document
from onshape_api.endpoints.versions import get_latest_version_path
from onshape_api.paths.doc_path import (
    DocumentPath,
    ElementPath,
    InstancePath,
)

router = flask.Blueprint("documents", __name__)


# @cacheable_route(router, "/documents")
# def get_documents(**kwargs):
#     """Returns a list of the top level documents to display to the user."""
#     db = connect.get_db()

#     documents: dict[str, dict] = {}

#     for doc_ref in db.documents.stream():
#         document = Document.model_validate(doc_ref.to_dict())
#         document_id = doc_ref.id

#         document_obj = document.model_dump(exclude_none=True)
#         document_obj["id"] = document_id
#         # Make it a valid InstancePath on the frontend
#         document_obj["instanceType"] = InstanceType.VERSION
#         document_obj["documentId"] = document_id

#         documents[document_id] = document_obj

#     return {"documents": documents}


# @cacheable_route(router, "/elements")
# def get_elements(**kwargs):
#     """Returns a list of the top level elements to display to the user."""
#     db = connect.get_db()
#     elements: dict[str, dict] = {}

#     for element_ref in db.elements.stream():
#         element_id = element_ref.id
#         element = Element.model_validate(element_ref.to_dict())

#         element_obj = element.model_dump(exclude_none=True)
#         element_obj["id"] = element_id
#         # Add instanceType and elementId so it's a valid ElementPath on the frontend
#         element_obj["instanceType"] = InstanceType.VERSION
#         element_obj["elementId"] = element_id

#         elements[element_id] = element_obj

#     return {"elements": elements}


def save_element(
    api: Api,
    document_ref: DocumentRef,
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
    configuration = None
    if len(onshape_configuration["configurationParameters"]) > 0:
        configuration = parse_onshape_configuration(onshape_configuration)
        # Re-use element db id since configurations can't be shared
        document_ref.configurations.configuration(element_id).set(configuration)
        configuration_id = element_id

    preserved_element = preserved_info.get_element(element_id)
    document_ref.elements.element(element_id).set(
        Element(
            name=element_name,
            vendors=parse_vendors(element_name, configuration),
            elementType=element_type,
            documentId=version_path.document_id,
            instanceId=version_path.instance_id,
            microversionId=onshape_element["microversionId"],
            configurationId=configuration_id,
            isVisible=preserved_element.isVisible,
        )
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


def get_valid_elements(
    document_ref: DocumentRef, contents: dict, preserved_info: PreservedInfo
) -> Iterator[dict]:
    for onshape_element in contents["elements"]:
        if onshape_element["elementType"] not in [
            ElementType.ASSEMBLY,
            ElementType.PART_STUDIO,
        ]:
            continue

        element = document_ref.elements.element(onshape_element["id"]).maybe_get()
        if element == None:
            yield onshape_element
            continue

        if not preserved_info.should_reload_element(
            onshape_element["id"], onshape_element["microversionId"]
        ):
            continue

        yield onshape_element


def add_document(api: Api, document: DocumentRef, version_path: InstancePath):
    """Loads all of the elements of a given document into the database."""
    return save_document(
        api,
        document,
        version_path,
        PreservedInfo(),
    )


async def save_document(
    api: Api,
    document_ref: DocumentRef,
    version_path: InstancePath,
    preserved_info: PreservedInfo,
) -> int:
    """Loads all of the elements of a given document into the database."""
    contents = await asyncio.to_thread(documents.get_contents, api, version_path)

    valid_elements = get_valid_elements(document_ref, contents, preserved_info)
    valid_ids = set(element["id"] for element in valid_elements)

    save_element_operations = [
        asyncio.to_thread(
            save_element,
            api,
            document_ref,
            version_path,
            onshape_element,
            preserved_info,
        )
        for onshape_element in valid_elements
    ]

    # Collect list of element ids in same order as the Onshape Tab manager
    ordered_element_ids = [
        element_id
        for element_id in get_ordered_element_ids(contents)
        if element_id in valid_ids
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
    document_ref.set(
        Document(
            name=onshape_document["name"],
            thumbnailElementId=thumbnail_element_id,
            instanceId=version_path.instance_id,
            elementIds=ordered_element_ids,
            sortAlphabetically=preserved_document.sortAlphabetically,
        )
    )
    return len(ordered_element_ids)


def preserve_info(library_ref: LibraryRef, reload_all: bool) -> PreservedInfo:
    preserved_info = PreservedInfo(reload_all=reload_all)
    for document_ref in library_ref.documents.list():
        preserved_info.save_document(document_ref.id, document_ref.get())

        for element in document_ref.elements.list():
            element_id = element.id
            preserved_info.save_element(element_id, element.get())

    return preserved_info


async def reload_document(
    api: Api,
    document_ref: DocumentRef,
    document_path: DocumentPath,
    preserved_info: PreservedInfo,
) -> int:
    latest_version_path = await asyncio.to_thread(
        get_latest_version_path, api, document_path
    )

    document = document_ref.maybe_get()
    if not document:
        # Document doesn't exist, create it immediately
        return await save_document(
            api, document_ref, latest_version_path, preserved_info
        )

    if document.instanceId == latest_version_path.instance_id:
        return 0

    # Refresh document
    return await save_document(api, document_ref, latest_version_path, preserved_info)


@router.post("/reload-documents" + connect.library_route())
@require_access_level()
async def reload_documents(**kwargs):
    """Saves the contents of the latest versions of all documents managed by FRC Design Lib into the database."""
    api = connect.get_api()
    library_ref = connect.get_library_ref()

    reload_all = connect.get_optional_body_arg("reloadAll", False)

    preserved_info = preserve_info(library_ref, reload_all)

    count = 0
    visited = set()

    documents_ref = library_ref.documents

    operations = []
    for document_id in documents_ref.keys():
        document_path = DocumentPath(document_id)
        visited.add(document_path.document_id)

        operations.append(
            reload_document(
                api, documents_ref.document(document_id), document_path, preserved_info
            )
        )

    results = await asyncio.gather(*operations)
    count = sum(results)

    clean_favorites(library_ref)

    return {"savedElements": count}


def clean_favorites(library_ref: LibraryRef) -> None:
    """Removes any favorites in the library that are no longer valid."""

    elements: dict[str, Element] = {}
    for document_ref in library_ref.documents.list():
        for element_ref in document_ref.elements.list():
            elements[element_ref.id] = element_ref.get()

    for user_data_ref in library_ref.user_data.list():
        for favorite in user_data_ref.favorites.list():
            element = elements.get(favorite.id)
            if element == None:
                continue

            # We have to remove all invisible favorites
            # This is necessary to prevent issues with reordering, as, e.g., Move to top is ambiguous with hidden elements
            if element.isVisible == True:
                continue

            user_data_ref.favorites.remove(favorite.id)


@router.post("/set-visibility" + connect.library_route())
@require_access_level()
def set_visibility(**kwargs):
    """Sets the visibility of one or more elements in a document."""
    library_ref = connect.get_library_ref()
    document_id = connect.get_body_arg("documentId")
    element_ids = connect.get_body_arg("elementIds")
    is_visible = connect.get_body_arg("isVisible")

    document_ref = library_ref.documents.document(document_id)

    if not is_visible:
        for user_data_ref in library_ref.user_data.list():
            for favorite in user_data_ref.favorites.list():
                if favorite.id in element_ids:
                    user_data_ref.favorites.remove(favorite.id)

    for element_id in element_ids:
        document_ref.elements.element(element_id).update({"isVisible": is_visible})
    return {"success": True}


@router.post("/set-document-sort" + connect.library_route())
@require_access_level()
def set_document_sort(**kwargs):
    library_ref = connect.get_library_ref()
    document_id = connect.get_body_arg("documentId")
    sort_alphabetically = connect.get_body_arg("sortAlphabetically")

    library_ref.documents.document(document_id).update(
        {"sortAlphabetically": sort_alphabetically}
    )
    return {"success": True}


@router.post("/document-order" + connect.library_route())
@require_access_level()
def set_document_order(**kwargs):
    library_ref = connect.get_library_ref()
    new_document_order = connect.get_body_arg("documentOrder")

    library_ref.documents.set_order(new_document_order)
    return {"success": True}


@router.post("/document" + connect.library_route())
@require_access_level()
async def add_document_route(**kwargs):
    api = connect.get_api()
    library_ref = connect.get_library_ref()

    new_document_id = connect.get_body_arg("newDocumentId")
    new_path = DocumentPath(new_document_id)
    # selected_document_id = connect.get_optional_body_arg("selectedDocumentId")

    try:
        document_name = get_document(api, new_path)["name"]
    except:
        raise HandledException("Failed to find the specified document.")

    try:
        latest_version = get_latest_version_path(api, new_path)
    except:
        raise HandledException("Failed to find a document version to use.")

    document_ref = library_ref.documents.document(new_document_id)

    keys = library_ref.documents.keys()
    if new_document_id in keys:
        raise HandledException("Document has already been added to library.")

    await save_document(api, document_ref, latest_version, PreservedInfo())
    return {"name": document_name}


@router.delete("/document" + connect.library_route())
@require_access_level()
def delete_document(**kwargs):
    library_ref = connect.get_library_ref()

    document_id = connect.get_query_param("documentId")
    library_ref.documents.remove(document_id)

    clean_favorites(library_ref)
    return {"Success": True}
