import flask

from backend.common import backend_exceptions
from backend.endpoints import get_values, insert, save_documents, settings
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


router.register_blueprint(save_documents.router)
router.register_blueprint(get_values.router)
router.register_blueprint(insert.router)
router.register_blueprint(settings.router)
