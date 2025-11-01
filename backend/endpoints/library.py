import flask
from pydantic import BaseModel

from backend.common import connect
from backend.common.models import Library
from backend.endpoints.cache import cacheable_route
from onshape_api.endpoints.documents import ElementType
from onshape_api.paths.instance_type import InstanceType


router = flask.Blueprint("library", __name__)


class ElementOut(BaseModel):
    id: str
    name: str
    elementType: ElementType

    elementId: str


class DocumentOut(BaseModel):
    id: str

    documentId: str
    microversionId: str
    instanceType: InstanceType
    instanceId: str

    name: str
    sortByDefault: bool
    elements: list[ElementOut]


class FavoriteOut(BaseModel):
    id: str
    defaultConfiguration: str | None


class LibraryOut(BaseModel):
    """A model representing a library that is sent to the frontend."""

    id: Library
    documents: list[DocumentOut]


@cacheable_route(router, connect.library_route())
def get_library(**kwargs):
    library_ref = connect.get_library_ref()
    library = library_ref.get()

    return library.model_dump_json(exclude_none=True)


class UserDataOut(BaseModel):
    favorites: list[FavoriteOut]


@cacheable_route(router, "/user-data" + connect.library_route())
def get_favorites(**kwargs):
    pass
