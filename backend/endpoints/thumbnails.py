from http import HTTPStatus
import flask

from backend.common import connect
from backend.common.connect import (
    element_path_route,
    get_optional_query_param,
    get_route_element_path,
)
from onshape_api.endpoints import thumbnails

router = flask.Blueprint("thumbnails", __name__)


@router.get("/thumbnail" + element_path_route())
def get_element_thumbnail(**kwargs):
    db = connect.get_db()
    api = connect.get_api(db)
    element_path = get_route_element_path()

    size = get_optional_query_param("size")
    thumbnail_id = get_optional_query_param("thumbnailId")

    if thumbnail_id == None:
        thumbnail = thumbnails.get_element_thumbnail(api, element_path, size)
    else:
        thumbnail = thumbnails.get_thumbnail_from_id(api, thumbnail_id, size)
    return flask.send_file(thumbnail, mimetype="image/gif")


@router.get("/thumbnail-id" + element_path_route())
def get_thumbnail_id(**kwargs):
    db = connect.get_db()
    api = connect.get_api(db)
    element_path = get_route_element_path()

    configuration = get_optional_query_param("configuration")
    try:
        return {
            "thumbnailId": thumbnails.get_thumbnail_id(api, element_path, configuration)
        }
    except:
        return flask.Response({"success": False}, status=HTTPStatus.REQUEST_TIMEOUT)
