import flask

from backend.common import backend_exceptions
from backend.endpoints import (
    add_part,
    cache,
    configurations,
    document_order,
    documents,
    thumbnails,
    user_data,
)
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


router.register_blueprint(documents.router)
router.register_blueprint(configurations.router)
router.register_blueprint(thumbnails.router)
router.register_blueprint(add_part.router)
router.register_blueprint(user_data.router)
router.register_blueprint(document_order.router)
router.register_blueprint(cache.router)
