import flask

from backend.common import connect, env
from backend.common.backend_exceptions import ServerException
from backend.common.connect import (
    element_path_route,
    get_optional_query_param,
    get_route_element_path,
    get_route_instance_path,
    instance_path_route,
)
from backend.endpoints.documents import Element
from onshape_api.endpoints import thumbnails
from onshape_api.paths.instance_type import InstanceType

router = flask.Blueprint("elements", __name__)


@router.get("/elements")
def get_elements(**kwargs):
    """Returns a list of the top level elements to display to the user."""
    db = connect.get_db()
    elements: list[dict] = []

    for element_ref in db.elements.stream():
        element_id = element_ref.id
        if env.IS_PRODUCTION:
            element = Element.model_construct(element_ref.to_dict())
        else:
            element = Element.model_validate(element_ref.to_dict())

        try:
            element_obj = element.model_dump(exclude_none=True)
            element_obj["id"] = element_id
            # Add instanceType and elementId so it's a valid ElementPath on the frontend
            element_obj["instanceType"] = InstanceType.VERSION
            element_obj["elementId"] = element_id
        except:
            raise ServerException("Failed to load element")

        elements.append(element_obj)

    return {"elements": elements}


@router.get("/thumbnail" + instance_path_route())
def get_document_thumbnail(**kwargs):
    db = connect.get_db()
    api = connect.get_api(db)
    instance_path = get_route_instance_path()
    size = get_optional_query_param("size")
    thumbnail = thumbnails.get_instance_thumbnail(api, instance_path, size)
    return flask.send_file(thumbnail, mimetype="image/gif")


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
    return {
        "thumbnailId": thumbnails.get_thumbnail_id(api, element_path, configuration)
    }
