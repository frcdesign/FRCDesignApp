import flask

from backend.common import backend_exceptions, connect, env
from backend.common.app_access import get_app_access_level
from backend.endpoints import (
    add_part,
    configurations,
    document_order,
    documents,
    elements,
    favorites,
)
from onshape_api.endpoints.users import AccessLevel
from onshape_api.exceptions import ApiError


router = flask.Blueprint("api", __name__, url_prefix="/api", static_folder="dist")


@router.errorhandler(ApiError)
def api_exception(e: ApiError):
    """A handler for uncaught exceptions thrown by the Api."""
    return e.to_dict(), e.status_code


@router.errorhandler(backend_exceptions.ServerException)
def backend_exception(e: backend_exceptions.ServerException):
    """A handler for uncaught exceptions thrown by the Api."""
    return e.to_dict(), e.status_code


@router.errorhandler(backend_exceptions.UserException)
def reported_exception(e: backend_exceptions.UserException):
    return e.to_dict(), e.status_code


@router.get("/access-level")
def get_access_level():
    max_access_level = get_app_access_level()
    current_access_level = AccessLevel.USER if env.IS_PRODUCTION else max_access_level
    return {
        "maxAccessLevel": max_access_level,
        "currentAccessLevel": current_access_level,
    }


router.register_blueprint(documents.router)
router.register_blueprint(configurations.router)
router.register_blueprint(elements.router)
router.register_blueprint(add_part.router)
router.register_blueprint(favorites.router)
router.register_blueprint(document_order.router)
