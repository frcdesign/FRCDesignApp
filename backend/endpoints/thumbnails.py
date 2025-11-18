from http import HTTPStatus
import flask

from backend.common import connect
from backend.common.app_access import require_access_level
from backend.common.backend_exceptions import HandledException
from backend.common.firebase_storage import upload_thumbnails
from backend.endpoints.cache import cacheable_route
from backend.common.connect import (
    element_path_route,
    get_optional_query_param,
    get_route_element_path,
    library_route,
)
from onshape_api.endpoints import thumbnails

router = flask.Blueprint("thumbnails", __name__)


@cacheable_route(router, "/thumbnail")
def get_element_thumbnail(**kwargs):
    api = connect.get_api()
    thumbnail_id = connect.get_query_param("thumbnailId")
    size = connect.get_query_param("size")

    thumbnail = thumbnails.get_thumbnail_from_id(api, thumbnail_id, size)
    return flask.send_file(thumbnail, mimetype="image/gif")


@router.get("/thumbnail-id" + element_path_route())
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


@router.post("/reload-thumbnail" + library_route() + element_path_route())
@require_access_level()
def reload_element_thumbnail(**kwargs):
    api = connect.get_api()
    element_path = get_route_element_path()
    microversion_id = connect.get_query_param("microversionId")
    element_ref = (
        connect.get_library_ref()
        .documents.document(element_path.document_id)
        .elements.element(element_path.element_id)
    )

    thumbnails = upload_thumbnails(api, element_path, microversion_id)
    if thumbnails == {}:
        raise HandledException("Failed to find any thumbnails to upload.")
    element_ref.update({"thumbnailUrls": thumbnails})
    return {"success": True}
