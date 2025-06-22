import logging
from urllib import parse
import flask

from backend.common import database
from backend.common import connect
from backend.common.connect import (
    element_route,
    get_optional_query_arg,
    get_route_element_path,
    get_route_instance_path,
    instance_route,
)
from onshape_api.endpoints import thumbnails
from onshape_api.paths.instance_type import InstanceType
from onshape_api.paths.paths import ElementPath, InstancePath

router = flask.Blueprint("get-values", __name__)


@router.get("/documents")
def get_documents(**kwargs):
    """Returns a list of the top level documents and elements to display to the user."""
    db = database.Database()

    documents = []
    elements = []

    for doc_ref in db.documents.stream():
        document = doc_ref.to_dict()
        element_ids = document["elementIds"]
        documents.append(
            {
                "id": doc_ref.id,
                "name": document["name"],
                "elementIds": element_ids,
                # InstancePath properties
                "documentId": doc_ref.id,
                "instanceId": document["instanceId"],
                "instanceType": InstanceType.VERSION,
            }
        )
        for element_id in document["elementIds"]:
            element = db.elements.document(element_id).get().to_dict()
            if element == None:
                raise ValueError(f"Missing element with id {element_id}")

            result = {
                "id": element_id,
                "name": element["name"],
                "elementType": element["elementType"],
                "configurationId": element.get("configurationId"),
                # Copy properties from document so we don't have to parse backreference on client
                "documentId": doc_ref.id,
                "instanceId": document["instanceId"],
                "instanceType": InstanceType.VERSION,
                # Include element id again out of laziness so we can parse it on the client
                "elementId": element_id,
            }
            elements.append(result)

    return {"documents": documents, "elements": elements}


@router.get("/configuration/<configuration_id>")
def get_configuration(configuration_id: str):
    """Returns a specific configuration."""
    db = database.Database()
    result = db.configurations.document(configuration_id).get().to_dict()
    logging.info(result)
    if result == None:
        raise ValueError(f"Failed to find configuration with id {configuration_id}")
    return result


@router.get("/thumbnail" + instance_route())
def get_document_thumbnail(**kwargs):
    db = database.Database()
    api = connect.get_api(db)
    instance_path = get_route_instance_path()
    size = get_optional_query_arg("size")
    thumbnail = thumbnails.get_instance_thumbnail(api, instance_path, size)
    return flask.send_file(thumbnail, mimetype="image/gif")


@router.get("/thumbnail" + element_route())
def get_element_thumbnail(**kwargs):
    db = database.Database()
    api = connect.get_api(db)
    element_path = get_route_element_path()
    configuration = get_optional_query_arg("configuration")
    size = get_optional_query_arg("size")
    thumbnail = thumbnails.get_element_thumbnail(
        api, element_path, configuration=configuration, size=size
    )
    return flask.send_file(thumbnail, mimetype="image/gif")
