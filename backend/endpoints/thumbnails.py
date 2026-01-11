from http import HTTPStatus
import flask

from backend.common import connect
from backend.common.app_access import require_access_level
from backend.common.backend_exceptions import HandledException
from backend.common.firebase_storage import upload_thumbnails
from backend.common.cache import cacheable_route
from backend.common.connect import (
    element_path_route,
    get_optional_query_param,
    get_route_element_path,
    instance_path_route,
    library_route,
)
from onshape_api.api.api_base import Api
from onshape_api.endpoints import documents, thumbnails
from onshape_api.paths.doc_path import ElementPath, InstancePath

router = flask.Blueprint("thumbnails", __name__)


@cacheable_route(router, "/thumbnail")
def get_element_thumbnail(**kwargs):
    api = connect.get_api()
    thumbnail_id = connect.get_query_param("thumbnailId")
    size = connect.get_query_param("size")

    thumbnail = thumbnails.get_thumbnail_from_id(api, thumbnail_id, size)
    return flask.send_file(thumbnail, mimetype="image/gif")


@cacheable_route(router, "/thumbnail-id" + element_path_route())
def get_thumbnail_id(**kwargs):
    api = connect.get_api()
    element_path = get_route_element_path()

    configuration = get_optional_query_param("configuration")
    try:
        return {
            "thumbnailId": thumbnails.get_thumbnail_id(api, element_path, configuration)
        }
    except:
        return flask.Response({"success": False}, status=HTTPStatus.REQUEST_TIMEOUT)


class ReloadDocumentThumbnail:
    def get_thumbnail_element_id(self, document: dict, contents: dict):
        thumbnail_element_id = document["documentThumbnailElementId"]
        if thumbnail_element_id == "":
            # Just use the first element id if it isn't set since an error could leave the db in a bad state
            elements = contents["elements"]
            if len(elements) < 1:
                raise HandledException(
                    f"Document {document["name"]} has no elements to use as a thumbnail."
                )
            thumbnail_element_id = elements[0]["id"]

        return thumbnail_element_id

    def get_microversion_id(self, contents: dict, thumbnail_element_id: str) -> str:
        for onshape_element in contents["elements"]:
            if onshape_element["id"] == thumbnail_element_id:
                return onshape_element["microversionId"]

        # This shouldn't ever happen because deleting the thumbnail tab = no more thumbnail tab
        raise HandledException(f"Unexpectedly failed to find a saved thumbnail tab!")

    def upload_thumbnails(
        self,
        api: Api,
        document: dict,
        contents: dict,
        version_path: InstancePath,
    ) -> dict:
        thumbnail_element_id = self.get_thumbnail_element_id(document, contents)
        thumbnail_path = ElementPath.from_path(version_path, thumbnail_element_id)

        thumbnail_microversion_id = self.get_microversion_id(
            contents, thumbnail_element_id
        )
        return upload_thumbnails(api, thumbnail_path, thumbnail_microversion_id)


@router.post("/reload-thumbnail" + library_route() + instance_path_route())
@require_access_level()
def reload_document_thumbnail(**kwargs):
    api = connect.get_api()
    document_path = connect.get_route_instance_path()

    document = documents.get_document(api, document_path)
    contents = documents.get_contents(api, document_path)

    thumbnails = ReloadDocumentThumbnail().upload_thumbnails(
        api, document, contents, document_path
    )

    if len(thumbnails) < 2:
        raise HandledException("Failed to upload thumbnail. Does it exist in Onshape?")

    document_ref = connect.get_library_ref().documents.document(
        document_path.document_id
    )

    existing_thumbnails = document_ref.get().thumbnailUrls
    if existing_thumbnails == thumbnails:
        raise HandledException("Thumbnail is already up to date.", is_error=False)

    document_ref.update({"thumbnailUrls": thumbnails})
    return {"success": True}


@router.post("/reload-thumbnail" + library_route() + element_path_route())
@require_access_level()
def reload_element_thumbnail(**kwargs):
    api = connect.get_api()
    element_path = get_route_element_path()

    element_ref = (
        connect.get_library_ref()
        .documents.document(element_path.document_id)
        .elements.element(element_path.element_id)
    )
    element = element_ref.get()

    thumbnails = upload_thumbnails(api, element_path, element.microversionId)
    if len(thumbnails) < 2:
        raise HandledException("Failed to upload thumbnail. Does it exist in Onshape?")

    existing_thumbnails = element.thumbnailUrls
    if existing_thumbnails == thumbnails:
        raise HandledException("Thumbnail is already up to date.", is_error=False)

    element_ref.update({"thumbnailUrls": thumbnails})
    return {"success": True}
