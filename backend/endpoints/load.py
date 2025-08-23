import flask

from backend.common import connect
from backend.common.backend_exceptions import ServerException, ClientException
from backend.common.connect import (
    element_path_route,
    get_optional_query_param,
    get_route_element_path,
    get_route_instance_path,
    instance_path_route,
)
from onshape_api.endpoints import thumbnails
from onshape_api.paths.instance_type import InstanceType

router = flask.Blueprint("load", __name__)


@router.get("/elements")
def get_elements(**kwargs):
    """Returns a list of the top level elements to display to the user."""
    db = connect.get_db()
    elements: list[dict] = []

    for element_ref in db.elements.stream():
        element_id = element_ref.id
        element_dict = element_ref.to_dict()
        if element_dict == None:
            raise ServerException(f"Missing element with id {element_id}")

        try:
            element_obj = {
                "id": element_id,
                "name": element_dict["name"],
                "elementType": element_dict["elementType"],
                "documentId": element_dict["documentId"],
                "instanceId": element_dict["instanceId"],
                "instanceType": InstanceType.VERSION,
                # Include element id again out of laziness so this becomes a valid ElementPath
                "elementId": element_id,
                "microversionId": element_dict["microversionId"],
                "isVisible": element_dict["isVisible"],
            }

            # Do not send a property with value None, as this results in a null (rather than undefined) on the client
            if element_dict.get("configurationId") != None:
                element_obj["configurationId"] = element_dict["configurationId"]

            if element_dict.get("vendor") != None:
                element_obj["vendor"] = element_dict["vendor"]
        except:
            raise ServerException("Failed to load element")

        elements.append(element_obj)

    return {"elements": elements}




@router.get("/configuration/<configuration_id>")
def get_configuration(configuration_id: str):
    """Returns a specific configuration.

    Returns:
        parameters: A list of configuration parameters.
    """
    db = connect.get_db()
    result = db.configurations.document(configuration_id).get().to_dict()
    if result == None:
        raise ClientException(
            f"Failed to find configuration with id {configuration_id}"
        )
    return result


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
