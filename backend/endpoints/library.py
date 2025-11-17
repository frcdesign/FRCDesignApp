import flask
from pydantic import BaseModel
from google.cloud import firestore

from backend.common import connect
from backend.common.app_access import require_access_level
from backend.common.database import DocumentsRef, LibraryRef
from backend.common.models import Document, Favorite
from backend.common.models import Document, Favorite, Vendor
from backend.endpoints.cache import cacheable_route
from onshape_api.endpoints.documents import ElementType
from onshape_api.endpoints.thumbnails import ThumbnailSize
from onshape_api.paths.instance_type import InstanceType


router = flask.Blueprint("library", __name__)


class InstancePathOut(BaseModel):
    documentId: str
    instanceId: str
    instanceType: InstanceType


class ElementPathOut(BaseModel):
    documentId: str
    instanceId: str
    instanceType: InstanceType
    elementId: str


class ElementOut(BaseModel):
    id: str
    documentId: str

    path: ElementPathOut
    name: str
    microversionId: str
    isVisible: bool
    isOpenComposite: bool
    supportsFasten: bool
    elementType: ElementType
    thumbnailUrls: dict[ThumbnailSize, str]
    configurationId: str | None
    vendors: list[Vendor]


class DocumentOut(BaseModel):
    id: str

    path: InstancePathOut
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
        document_id = document_ref.id
        documents_out[document_id] = DocumentOut(
            id=document_id,
            path=InstancePathOut(
                documentId=document_id,
                instanceId=document.instanceId,
                instanceType=InstanceType.VERSION,
            ),
            name=document.name,
            sortAlphabetically=document.sortAlphabetically,
            thumbnailUrls=document.thumbnailUrls,
            elementOrder=document_ref.elements.keys(),
        )

        for element_ref in document_ref.elements.list():
            element = element_ref.get()
            elements_out[element_ref.id] = ElementOut(
                id=element_ref.id,
                documentId=document_id,
                path=ElementPathOut(
                    documentId=document_id,
                    instanceId=document.instanceId,
                    instanceType=InstanceType.VERSION,
                    elementId=element_ref.id,
                ),
                name=element.name,
                isVisible=element.isVisible,
                isOpenComposite=element.isOpenComposite,
                supportsFasten=element.fastenInfo != None,
                thumbnailUrls=element.thumbnailUrls,
                microversionId=element.microversionId,
                elementType=element.elementType,
                configurationId=element.configurationId,
                vendors=element.vendors,
            )

    return (documents_out, elements_out)


@cacheable_route(router, "/search-db" + connect.library_route())
def get_search_db(**kwargs):
    library_ref = connect.get_library_ref()
    library = library_ref.get()
    return {"searchDb": library.searchDb}


class FavoriteOut(BaseModel):
    id: str
    defaultConfiguration: dict[str, str] | None


class LibraryUserDataOut(BaseModel):
    favorites: dict[str, FavoriteOut]
    favoriteOrder: list[str]


@router.get("/library-user-data" + connect.library_route() + connect.user_path_route())
def get_library_user_data(**kwargs):
    user_id = connect.get_route_user_path().user_id
    library_ref = connect.get_library_ref()

    favorites_ref = library_ref.user_data.user_data(user_id).favorites
    favorites: dict[str, FavoriteOut] = {}
    for favorite_ref in favorites_ref.list():
        favorite = favorite_ref.get()
        favorites[favorite_ref.id] = FavoriteOut(
            id=favorite_ref.id, defaultConfiguration=favorite.defaultConfiguration
        )

    return LibraryUserDataOut(
        favorites=favorites, favoriteOrder=favorites_ref.keys()
    ).model_dump_json(exclude_none=True)


@router.post("/favorites" + connect.library_route() + connect.user_path_route())
def add_favorite(**kwargs):
    library_ref = connect.get_library_ref()
    user_path = connect.get_route_user_path()
    element_id = connect.get_query_param("elementId")
    default_configuration = connect.get_optional_body_arg("defaultConfiguration")

    # Add it to favorite-order
    user_ref = library_ref.user_data.user_data(user_path.user_id)
    user_ref.favorites.add(
        element_id, Favorite(defaultConfiguration=default_configuration)
    )

    return {"success": True}


@router.delete("/favorites" + connect.library_route() + connect.user_path_route())
def remove_favorite(**kwargs):
    library_ref = connect.get_library_ref()
    user_path = connect.get_route_user_path()
    element_id = connect.get_query_param("elementId")

    user_ref = library_ref.user_data.user_data(user_path.user_id)
    user_ref.favorites.remove(element_id)

    return {"success": True}


@router.post("/favorite-order" + connect.library_route() + connect.user_path_route())
def set_favorite_order(**kwargs):
    """Sets the order of the current user's favorites."""
    library_ref = connect.get_library_ref()
    user_path = connect.get_route_user_path()
    favorite_order = connect.get_body_arg("favoriteOrder")

    user_ref = library_ref.user_data.user_data(user_path.user_id)
    user_ref.favorites.set_order(favorite_order)

    return {"success": True}


@router.post(
    "/default-configuration" + connect.library_route() + connect.user_path_route()
)
def update_default_configuration(**kwargs):
    library_ref = connect.get_library_ref()
    user_path = connect.get_route_user_path()
    favorite_id = connect.get_body_arg("favoriteId")
    default_configuration = connect.get_body_arg("defaultConfiguration")

    favorite_ref = library_ref.user_data.user_data(
        user_path.user_id
    ).favorites.favorite(favorite_id)

    favorite_ref.update({"defaultConfiguration": default_configuration})

    return {"success": True}


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
