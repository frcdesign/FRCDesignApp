import flask

from backend.common.connect import (
    get_api,
    get_body_arg,
    get_db,
    get_library_ref,
    get_query_param,
    get_route_library,
    library_route,
)
from backend.common.app_access import require_access_level
from backend.common.backend_exceptions import HandledException
from backend.endpoints.documents import clean_favorites, save_document
from backend.endpoints.preserved_info import PreservedInfo
from onshape_api.endpoints.documents import get_document
from onshape_api.endpoints.versions import get_latest_version_path
from onshape_api.paths.doc_path import DocumentPath


router = flask.Blueprint("document-order", __name__)
