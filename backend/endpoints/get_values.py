import logging
import flask

from backend.common import database
from backend.common import connect
from backend.common.connect import (
    element_path_route,
    get_optional_query_arg,
    get_route_element_path,
    get_route_instance_path,
    instance_path_route,
)
from onshape_api.endpoints import thumbnails
from onshape_api.paths.instance_type import InstanceType

router = flask.Blueprint("get-values", __name__)


@router.get("/documents")
def get_documents(**kwargs):
    """Returns a list of the top level documents and elements to display to the user."""
    db = database.Database()

    documents: dict[str, dict] = dict()
    elements: dict[str, dict] = dict()

    for doc_ref in db.documents.stream():
        document = doc_ref.to_dict()
        document_id = doc_ref.id
        element_ids = document["elementIds"]
        documents[document_id] = {
            "id": document_id,
            "name": document["name"],
            "elementIds": element_ids,
            # InstancePath properties
            "documentId": doc_ref.id,
            "instanceId": document["instanceId"],
            "instanceType": InstanceType.VERSION,
        }
        for element_id in document["elementIds"]:
            element = db.elements.document(element_id).get().to_dict()
            if element == None:
                raise ValueError(f"Missing element with id {element_id}")

            element_obj = {
                "id": element_id,
                "name": element["name"],
                "elementType": element["elementType"],
                # Copy properties from document so we don't have to parse backreference on client
                "documentId": doc_ref.id,
                "instanceId": document["instanceId"],
                "instanceType": InstanceType.VERSION,
                # Include element id again out of laziness so we can parse it on the client
                "elementId": element_id,
                "isVisible": element["isVisible"],
            }

            # Do not send a property with value None, as this results in a null (rather than undefined) on the client
            if element.get("configurationId") != None:
                element_obj["configurationId"] = element["configurationId"]

            if element.get("vendor") != None:
                element_obj["vendor"] = element["vendor"]

            elements[element_id] = element_obj

    return {"documents": documents, "elements": elements}


@router.get("/configuration/<configuration_id>")
def get_configuration(configuration_id: str):
    """Returns a specific configuration."""
    db = database.Database()
    result = db.configurations.document(configuration_id).get().to_dict()
    if result == None:
        raise ValueError(f"Failed to find configuration with id {configuration_id}")
    return result


@router.get("/thumbnail" + instance_path_route())
def get_document_thumbnail(**kwargs):
    db = database.Database()
    api = connect.get_api(db)
    instance_path = get_route_instance_path()
    size = get_optional_query_arg("size")
    thumbnail = thumbnails.get_instance_thumbnail(api, instance_path, size)
    return flask.send_file(thumbnail, mimetype="image/gif")


@router.get("/thumbnail" + element_path_route())
def get_element_thumbnail(**kwargs):
    db = database.Database()
    api = connect.get_api(db)
    element_path = get_route_element_path()

    size = get_optional_query_arg("size")
    thumbnail_id = get_optional_query_arg("thumbnailId")

    if thumbnail_id == None:
        thumbnail = thumbnails.get_element_thumbnail(api, element_path, size)
    else:
        thumbnail = thumbnails.get_thumbnail_from_id(api, thumbnail_id, size)
    return flask.send_file(thumbnail, mimetype="image/gif")


@router.get("/thumbnail-id" + element_path_route())
def get_thumbnail_id(**kwargs):
    db = database.Database()
    api = connect.get_api(db)
    element_path = get_route_element_path()

    configuration = get_optional_query_arg("configuration")
    logging.info(configuration)
    return {
        "thumbnailId": thumbnails.get_thumbnail_id(api, element_path, configuration)
    }
