import flask
from pydantic import BaseModel
from google.cloud import firestore

from backend.common import connect
from backend.common.app_access import require_access_level
from backend.common.database import DocumentsRef, LibraryRef
from backend.common.models import Document, Favorite
from backend.endpoints.cache import cacheable_route
from onshape_api.endpoints.documents import ElementType
from onshape_api.endpoints.thumbnails import ThumbnailSize
from onshape_api.paths.instance_type import InstanceType


router = flask.Blueprint("library", __name__)


class ElementOut(BaseModel):
    id: str

    documentId: str
    instanceType: InstanceType
    instanceId: str
    elementId: str

    name: str
    microversionId: str
    isVisible: bool
    elementType: ElementType
    thumbnailUrls: dict[ThumbnailSize, str]


class DocumentOut(BaseModel):
    id: str

    documentId: str
    instanceType: InstanceType
    instanceId: str

    name: str
    sortAlphabetically: bool
    thumbnailUrls: dict[ThumbnailSize, str]

    elementOrder: list[str]


class LibraryOut(BaseModel):
    """A model representing a library that is sent to the frontend."""

    documentOrder: list[str]
    documents: dict[str, DocumentOut]
    elements: dict[str, ElementOut]


@cacheable_route(router, connect.library_route())
def get_library(**kwargs):
    library_ref = connect.get_library_ref()
    return build_library_out(library_ref).model_dump_json(exclude_none=True)


def build_library_out(library_ref: LibraryRef) -> LibraryOut:
    documents, elements = build_documents_out(library_ref.documents)
    return LibraryOut(
        documentOrder=library_ref.documents.keys(),
        documents=documents,
        elements=elements,
    )


def build_documents_out(
    documents_ref: DocumentsRef,
) -> tuple[dict[str, DocumentOut], dict[str, ElementOut]]:
    documents_out: dict[str, DocumentOut] = {}
    elements_out: dict[str, ElementOut] = {}

    for document_ref in documents_ref.list():
        document: Document = document_ref.get()
        documents_out[document_ref.id] = DocumentOut(
            id=document_ref.id,
            documentId=document_ref.id,
            instanceId=document.instanceId,
            instanceType=InstanceType.VERSION,
            name=document.name,
            sortAlphabetically=document.sortAlphabetically,
            thumbnailUrls=document.thumbnailUrls,
            elementOrder=document_ref.elements.keys(),
        )

        for element_ref in document_ref.elements.list():
            element = element_ref.get()
            elements_out[element_ref.id] = ElementOut(
                id=element_ref.id,
                elementId=element_ref.id,
                documentId=element.documentId,
                instanceId=element.instanceId,
                instanceType=InstanceType.VERSION,
                name=element.name,
                isVisible=element.isVisible,
                thumbnailUrls=element.thumbnailUrls,
                microversionId=element.microversionId,
                elementType=element.elementType,
            )

    return (documents_out, elements_out)


@cacheable_route(router, "/search-db" + connect.library_route())
def get_search_db(**kwargs):
    library_ref = connect.get_library_ref()
    library = library_ref.get()
    return {"searchDb": library.searchDb}


@router.post("/library-version" + connect.library_route())
@require_access_level()
def push_library_version(**kwargs):
    """
    Invalidates all CDN caching by pushing a new version of a library.
    """
    library_ref = connect.get_library_ref()
    new_search_db = connect.get_body_arg("searchDb")

    library_ref.update(
        {"searchDb": new_search_db, "cacheVersion": firestore.Increment(1)}
    )
    return {"success": True}
