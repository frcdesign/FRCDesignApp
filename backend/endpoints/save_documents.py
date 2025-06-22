from enum import StrEnum
import flask
import json5

from backend.common import connect, database
from onshape_api.api.api_base import Api
from onshape_api.endpoints import documents
from onshape_api.endpoints.configurations import encode_configuration, get_configuration
from onshape_api.endpoints.documents import ElementType
from onshape_api.endpoints.versions import get_latest_version_path
from onshape_api.paths.paths import (
    ElementPath,
    InstancePath,
    url_to_document_path,
)

router = flask.Blueprint("save-documents", __name__)


class ParameterType(StrEnum):
    ENUM = "BTMConfigurationParameterEnum-105"
    QUANTITY = "BTMConfigurationParameterQuantity-1826"
    BOOLEAN = "BTMConfigurationParameterBoolean-2550"
    STRING = "BTMConfigurationParameterString-872"


class QuantityType(StrEnum):
    LENGTH = "LENGTH"
    ANGLE = "ANGLE"
    INTEGER = "INTEGER"
    REAL = "REAL"


class Unit(StrEnum):
    METER = "meter"
    CENTIMETER = "centimeter"
    MILLIMETER = "millimeter"
    YARD = "yard"
    FOOT = "foot"
    INCH = "inch"
    DEGREE = "degree"
    RADIAN = "radian"
    UNITLESS = ""


def get_abbreviation(unit: Unit) -> str:
    match unit:
        case Unit.METER:
            return "m"
        case Unit.CENTIMETER:
            return "cm"
        case Unit.MILLIMETER:
            return "mm"
        case Unit.YARD:
            return "yd"
        case Unit.FOOT:
            return "ft"
        case Unit.INCH:
            return "in"
        case Unit.DEGREE:
            return "deg"
        case Unit.RADIAN:
            return "rad"
        case Unit.UNITLESS:
            return ""


def parse_configuration(configuration: dict) -> dict:
    parameters = []
    for parameter in configuration["configurationParameters"]:
        parameter_type = parameter["btType"]
        result = {
            "id": parameter["parameterId"],
            "name": parameter["parameterName"],
            "type": parameter_type,
        }
        if parameter_type == ParameterType.ENUM:
            result["default"] = parameter["defaultValue"]
            result["options"] = [
                {"id": option["option"], "name": option["optionName"]}
                for option in parameter["options"]
            ]
        elif parameter_type == ParameterType.BOOLEAN:
            # Convert to "true" or "false" for simplicity
            result["default"] = str(parameter["defaultValue"]).lower()
        elif parameter_type == ParameterType.STRING:
            result["default"] = parameter["defaultValue"]
        elif parameter_type == ParameterType.QUANTITY:
            quantity_type = parameter["quantityType"]
            range = parameter["rangeAndDefault"]

            unit: Unit = range["units"]
            default = f"{range["defaultValue"]} {get_abbreviation(unit)}"
            result.update(
                {
                    "quantityType": quantity_type,
                    "default": default,
                    "min": range["minValue"],
                    "max": range["maxValue"],
                    "unit": range["units"],  # empty string for real and integer
                }
            )

        parameters.append(result)

    default_value = encode_configuration(
        {param["id"]: param["default"] for param in parameters}
    )
    return {"defaultConfiguration": default_value, "parameters": parameters}


def save_element(
    db: database.Database, api: Api, version_path: InstancePath, element: dict
) -> str:
    element_type: ElementType = element["elementType"]
    name = element["name"]  # Use the name of the tab
    element_id = element["id"]
    path = ElementPath.from_path(version_path, element_id)

    element_db_value = {
        "name": name,
        "elementType": element_type,
        "documentId": version_path.document_id,
        "elementType": element_type,
    }

    configuration = get_configuration(api, path)
    if len(configuration["configurationParameters"]) > 0:
        configuration_value = parse_configuration(configuration)
        # Re-use element db id since configurations can't be shared
        db.configurations.document(element_id).set(configuration_value)
        element_db_value["configurationId"] = element_id

    db.elements.document(element_id).set(element_db_value)
    return element_id


def save_document(api: Api, db: database.Database, version_path: InstancePath) -> int:
    """Loads all of the elements of a given document into the database."""
    contents = documents.get_contents(api, version_path)

    element_ids = [
        save_element(db, api, version_path, element)
        for element in contents["elements"]
        if element["elementType"] in [ElementType.ASSEMBLY, ElementType.PART_STUDIO]
    ]

    document = documents.get_document(api, version_path)
    if document["documentThumbnailElementId"] == None:
        # TODO: Report an error
        pass

    document_name = document["name"]
    db.documents.document(version_path.document_id).set(
        {
            "name": document_name,
            "instanceId": version_path.instance_id,
            "elementIds": element_ids,
        }
    )
    return len(element_ids)


@router.post("/save-all-documents")
def save_all_documents(**kwargs):
    """Saves the contents of the latest versions of all documents managed by FRC Design Lib into the database."""
    db = database.Database()
    api = connect.get_api(db)

    with open("config.json") as file:
        config = json5.load(file)

    # Iterate in reverse so the result is ordered
    documents_list = reversed(config["documents"])

    count = 0
    visited = set()
    for document_url in documents_list:
        path = url_to_document_path(document_url)
        visited.add(path.document_id)

        latest_version_path = get_latest_version_path(api, path)
        document = db.documents.document(path.document_id).get().to_dict()
        if document == None:
            count += save_document(api, db, latest_version_path)
            continue
        # Version is already saved
        if document.get("instanceId") == latest_version_path.instance_id:
            continue

        db.delete_document(path.document_id)
        count += save_document(api, db, latest_version_path)

    # Clean up any documents that are no longer in the config
    for doc_ref in db.documents.stream():
        if doc_ref.id in visited:
            continue
        db.delete_document(doc_ref.id)

    return {"savedElements": count}
