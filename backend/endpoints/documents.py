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
from backend.common.database import DocumentRef, DocumentsRef, LibraryRef
from backend.common.app_access import require_access_level
from backend.common.firebase_storage import upload_thumbnails
from backend.common.models import (
    Element,
)
from backend.common.models import Document
from backend.common.vendors import parse_vendors
from backend.endpoints.configurations import parse_onshape_configuration
from backend.common.reload_context import (
    ReloadContext,
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


def save_element(
    api: Api,
    document_ref: DocumentRef,
    version_path: InstancePath,
    onshape_element: dict,
    reload_context: ReloadContext,
) -> str:
    """
    Parameters:
        element: A part studio or assembly returned by the /elements endpoint.
    """

    element_type: ElementType = onshape_element["elementType"]
    element_name = onshape_element["name"]  # Use the name of the tab
    element_id = onshape_element["id"]
    microversion_id = onshape_element["microversionId"]

    path = ElementPath.from_path(version_path, element_id)

    onshape_configuration = get_configuration(api, path)
    configuration_id = None
    configuration = None
    if len(onshape_configuration["configurationParameters"]) > 0:
        configuration = parse_onshape_configuration(onshape_configuration)
        # Re-use element db id since configurations can't be shared
        document_ref.configurations.configuration(element_id).set(configuration)
        configuration_id = element_id

    thumbnailUrls = upload_thumbnails(api, path, microversion_id)

    preserved_element = reload_context.get_element(element_id)
    document_ref.elements.element(element_id).set(
        Element(
            name=element_name,
            vendors=parse_vendors(element_name, configuration),
            elementType=element_type,
            documentId=version_path.document_id,
            instanceId=version_path.instance_id,
            microversionId=microversion_id,
            configurationId=configuration_id,
            isVisible=preserved_element.isVisible,
            isOpenComposite=preserved_element.isOpenComposite,
            fastenInfo=preserved_element.fastenInfo,
            thumbnailUrls=thumbnailUrls,
        ),
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


def get_valid_elements(contents: dict) -> Iterator[dict]:
    for onshape_element in contents["elements"]:
        if onshape_element["elementType"] not in [
            ElementType.ASSEMBLY,
            ElementType.PART_STUDIO,
        ]:
            continue

        yield onshape_element


def get_elements_to_reload(
    document_ref: DocumentRef,
    valid_elements: list[dict],
    reload_context: ReloadContext,
) -> Iterator[dict]:
    for onshape_element in valid_elements:
        element = document_ref.elements.element(onshape_element["id"]).maybe_get()
        if element == None:
            yield onshape_element
            continue

        if reload_context.should_reload_element(
            onshape_element["id"], onshape_element["microversionId"]
        ):
            yield onshape_element


def get_element_microversion_id(contents: dict, element_id: str) -> str | None:
    for onshape_element in contents["elements"]:
        if onshape_element["id"] == element_id:
            return onshape_element["microversionId"]
    return None


async def save_document(
    api: Api,
    document_ref: DocumentRef,
    version_path: InstancePath,
    reload_context: ReloadContext,
) -> int:
    """Loads all of the elements of a given document into the database.

    Note this function does NOT update documentOrder; it is up to the caller to add it themselves.
    """
    document_id = version_path.document_id

    # Get document synchronously up front to do validation
    onshape_document = await asyncio.to_thread(
        documents.get_document, api, version_path
    )
    thumbnail_element_id = onshape_document["documentThumbnailElementId"]
    if thumbnail_element_id == "":
        raise HandledException(
            onshape_document["name"] + " does not have a thumbnail tab set"
        )

    contents = await asyncio.to_thread(documents.get_contents, api, version_path)

    thumbnail_path = ElementPath.from_path(version_path, thumbnail_element_id)
    thumbnail_microversion_id = get_element_microversion_id(
        contents, thumbnail_element_id
    )

    if thumbnail_microversion_id is None:
        raise HandledException(
            f"Could not find the thumbnail tab for {onshape_document["name"]} in the latest version of a document"
        )
    thumbnail_urls = upload_thumbnails(api, thumbnail_path, thumbnail_microversion_id)

    valid_elements = list(get_valid_elements(contents))

    valid_element_ids = {onshape_element["id"] for onshape_element in valid_elements}

    elements_to_reload = list(
        get_elements_to_reload(document_ref, valid_elements, reload_context)
    )

    save_element_operations = [
        asyncio.to_thread(
            save_element,
            api,
            document_ref,
            version_path,
            onshape_element,
            reload_context,
        )
        for onshape_element in elements_to_reload
    ]

    await asyncio.gather(*save_element_operations)

    # Collect list of element ids in same order as the Onshape Tab manager
    ordered_ids = [
        element_id
        for element_id in get_ordered_element_ids(contents)
        if element_id in valid_element_ids
    ]

    # Delete any elements present in the current order but not the new order
    elements_to_delete = set(document_ref.elements.keys()) - set(ordered_ids)
    for element_id in elements_to_delete:
        document_ref.elements.element(element_id).delete()
        document_ref.configurations.configuration(element_id).delete()

    preserved_document = reload_context.get_document(document_id)
    # Document order is externally managed, so just set the document directly
    document_ref.set(
        Document(
            name=onshape_document["name"],
            thumbnailUrls=thumbnail_urls,
            instanceId=version_path.instance_id,
            elementOrder=ordered_ids,
            sortAlphabetically=preserved_document.sortAlphabetically,
        ),
    )
    return len(elements_to_reload)


def build_reload_context(library_ref: LibraryRef, reload_all: bool) -> ReloadContext:
    reload_context = ReloadContext(reload_all=reload_all)
    for document_ref in library_ref.documents.list():
        reload_context.save_document(document_ref.id, document_ref.get())

        for element in document_ref.elements.list():
            element_id = element.id
            reload_context.save_element(element_id, element.get())

    return reload_context


async def reload_document(
    api: Api,
    documents_ref: DocumentsRef,
    document_path: DocumentPath,
    reload_context: ReloadContext,
) -> int:
    latest_version_path = await asyncio.to_thread(
        get_latest_version_path, api, document_path
    )

    document_ref = documents_ref.document(document_path.document_id)
    if not document_ref.maybe_get():
        # Document doesn't exist, create it immediately
        return await save_document(
            api, document_ref, latest_version_path, reload_context
        )

    if not reload_context.should_reload_document(latest_version_path):
        return 0

    # Refresh document
    return await save_document(api, document_ref, latest_version_path, reload_context)


@router.post("/reload-documents" + connect.library_route())
@require_access_level()
async def reload_documents(**kwargs):
    """Saves the contents of the latest versions of all documents managed by FRC Design Lib into the database."""
    api = connect.get_api()
    library_ref = connect.get_library_ref()

    reload_all = connect.get_query_bool("reloadAll", False)

    reload_context = build_reload_context(library_ref, reload_all)

    count = 0

    documents_ref = library_ref.documents

    operations = []
    for document_id in documents_ref.keys():
        document_path = DocumentPath(document_id)
        operations.append(
            reload_document(api, documents_ref, document_path, reload_context)
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

    library_ref.documents.child(document_id).update(
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
    selected_document_id = connect.get_optional_body_arg("selectedDocumentId")

    try:
        document_name = get_document(api, new_path)["name"]
    except:
        raise HandledException("Failed to find the specified document.")

    try:
        latest_version = get_latest_version_path(api, new_path)
    except:
        raise HandledException("Failed to find a document version to use.")

    document_order = library_ref.documents.keys()
    if new_document_id in document_order:
        raise HandledException("Document has already been added to library.")

    if selected_document_id:
        if selected_document_id not in document_order:
            raise HandledException("Selected document not found in library.")

        selected_index = document_order.index(selected_document_id)
        document_order.insert(selected_index + 1, new_document_id)
    else:
        document_order.append(new_document_id)

    document_ref = library_ref.documents.document(new_document_id)
    await save_document(api, document_ref, latest_version, ReloadContext())

    # Update order after we've successfully added the document
    library_ref.documents.set_order(document_order)
    return {"name": document_name}


@router.delete("/document" + connect.library_route())
@require_access_level()
def delete_document(**kwargs):
    library_ref = connect.get_library_ref()

    document_id = connect.get_query_param("documentId")
    library_ref.documents.remove(document_id)

    clean_favorites(library_ref)
    return {"Success": True}
