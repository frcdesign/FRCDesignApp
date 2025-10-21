from http import HTTPStatus
import flask

from google.cloud import storage
from google.cloud.exceptions import NotFound

from backend.common import connect
from backend.endpoints.cache import cacheable_route
from backend.common.connect import (
    element_path_route,
    get_optional_query_param,
    get_route_element_path,
)
from onshape_api.api.api_base import Api
from onshape_api.endpoints import thumbnails
from onshape_api.endpoints.thumbnails import ThumbnailSize
from onshape_api.paths.doc_path import ElementPath

router = flask.Blueprint("thumbnails", __name__)


@cacheable_route(router, "/thumbnail" + element_path_route())
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


STORAGE_CLIENT = storage.Client(project="frc-design-lib")
BUCKET_NAME = "frc-design-app-data"


def upload_thumbnail(
    api: Api, element_path: ElementPath, microversion_id: str
) -> dict | None:
    """Uploads a thumbnail to Google Cloud Storage."""
    bucket = STORAGE_CLIENT.bucket(BUCKET_NAME)

    if is_uploaded(element_path.element_id, microversion_id):
        return None

    urls = {}
    for size in [ThumbnailSize.SMALL, ThumbnailSize.STANDARD]:
        thumbnail = thumbnails.get_element_thumbnail(api, element_path, size)

        blob = bucket.blob(f"thumbnails/{size}/{element_path.element_id}")

        blob.upload_from_string(
            thumbnail.getvalue(),
            content_type="image/gif",
        )

        # As far as I can tell, there isn't a way to include metadata in upload_from_string
        blob.metadata = {
            "Cache-Control": "public, max-age={MAX_AGE}",
            "microversionId": microversion_id,
        }
        blob.patch()
        urls[size] = blob.public_url + "?v=" + microversion_id

    return urls


def is_uploaded(element_id: str, microversion_id: str) -> bool:
    """Checks if thumbnails have already been uploaded to GCP storage.

    Realistically, I don't expect this to return False, but it can save us some calls if it does.
    """
    bucket = STORAGE_CLIENT.bucket(BUCKET_NAME)

    try:
        blob = bucket.blob(f"thumbnails/{ThumbnailSize.SMALL}/{element_id}")
        blob.reload()
        if blob.metadata and blob.metadata.get("microversionId") == microversion_id:
            # This microversion has already been uploaded
            return True
    except NotFound:
        return False

    return False
