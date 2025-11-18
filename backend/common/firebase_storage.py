"""In a perfect world we would use google-cloud-storage, but it doesn't have a good dev emulator, so we use firebase-admin instead."""

from __future__ import annotations
from io import BytesIO
import time

import firebase_admin
from firebase_admin import storage
from google.cloud.storage import Bucket
from google.cloud.exceptions import NotFound

from backend.common.backend_exceptions import HandledException
from backend.endpoints.cache import MAX_AGE
from onshape_api.api.api_base import Api
from onshape_api.endpoints import thumbnails
from onshape_api.endpoints.thumbnails import ThumbnailSize
from onshape_api.exceptions import OnshapeException
from onshape_api.paths.doc_path import ElementPath

BUCKET_NAME = "frc-design-app-data"


def _ensure_firebase():
    if not firebase_admin._apps:
        firebase_admin.initialize_app(
            None, {"storageBucket": BUCKET_NAME, "projectId": "frc-design-lib"}
        )


def get_bucket() -> Bucket:
    """Gets the GCP storage bucket."""
    _ensure_firebase()
    return storage.bucket(BUCKET_NAME)


def maybe_get_thumbnail(
    api: Api,
    element_path: ElementPath,
    size: ThumbnailSize = ThumbnailSize.STANDARD,
) -> BytesIO | None:
    """Gets a thumbnail."""
    try:
        return thumbnails.get_element_thumbnail(api, element_path, size)
    except OnshapeException:
        return None


def upload_thumbnails(
    api: Api, element_path: ElementPath, microversion_id: str
) -> dict:
    """Uploads thumbnails to Google Cloud Storage."""
    bucket = get_bucket()

    urls = {}
    for size in [ThumbnailSize.TINY, ThumbnailSize.STANDARD]:
        if is_uploaded(element_path.element_id, microversion_id, size):
            urls[size] = blob.public_url + "?v=" + microversion_id
            continue

        thumbnail = maybe_get_thumbnail(api, element_path, size)
        if thumbnail == None:
            continue

        blob = bucket.blob(f"thumbnails/{size}/{element_path.element_id}")
        blob.cache_control = f"public, max-age={MAX_AGE}"
        blob.metadata = {
            "microversionId": microversion_id,
        }

        blob.upload_from_string(
            thumbnail.getvalue(),
            content_type="image/gif",
        )

        urls[size] = blob.public_url + "?v=" + microversion_id

    return urls


def is_uploaded(element_id: str, microversion_id: str, size: ThumbnailSize) -> bool:
    """Checks the given thumbnail has already been uploaded to GCP storage."""
    bucket = get_bucket()

    try:
        blob = bucket.blob(f"thumbnails/{size}/{element_id}")
        blob.reload()  # raises NotFound if it doesn't exist
        if blob.metadata and blob.metadata.get("microversionId") == microversion_id:
            # This microversion has already been uploaded
            return True
    except NotFound:
        return False

    return False
