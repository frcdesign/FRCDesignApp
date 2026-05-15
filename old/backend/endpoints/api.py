import flask

from backend.common import backend_exceptions
from backend.endpoints import (
    add_part,
    configurations,
    documents,
    library,
    thumbnails,
    user_data,
)
from onshape_api.exceptions import OnshapeException


router = flask.Blueprint("api", __name__, url_prefix="/api", static_folder="dist")


@router.errorhandler(OnshapeException)
def onshape_exception(e: OnshapeException):
    """A handler for uncaught errors thrown by the Onshape API."""
    # result = e.to_dict()
    # result["type"] = backend_exceptions.ExceptionType.API
    return e.to_dict(), e.status_code


@router.errorhandler(backend_exceptions.BaseAppException)
def backend_exception(e: backend_exceptions.BaseAppException):
    """A handler for uncaught exceptions thrown by the App."""
    return e.to_dict(), e.status_code


router.register_blueprint(documents.router)
router.register_blueprint(configurations.router)
router.register_blueprint(thumbnails.router)
router.register_blueprint(add_part.router)
router.register_blueprint(user_data.router)
router.register_blueprint(library.router)
