from __future__ import annotations
import flask
import json5

from backend.common import connect, database
from backend.common.access import require_admin_access, require_member_access
from backend.endpoints.backend_types import (
    NONE_CONDITION,
    ConditionType,
    LogicalOp,
    ParameterType,
    Unit,
    get_abbreviation,
    parse_vendor,
)
from backend.endpoints.preserved_info import (
    PreservedInfo,
)
from onshape_api.api.api_base import Api
from onshape_api.endpoints import documents
from onshape_api.endpoints.configurations import get_configuration
from onshape_api.endpoints.documents import ElementType
from onshape_api.endpoints.versions import get_latest_version_path
from onshape_api.paths.doc_path import (
    ElementPath,
    InstancePath,
    url_to_document_path,
)

router = flask.Blueprint("save-documents", __name__)


def evaluate(condition_dict: dict | None, configuration: dict[str, str]) -> bool:
    """Evaluates a configuration against a given configuration_dict."""
    if condition_dict == None:
        return True

    if condition_dict["type"] == ConditionType.LOGICAL:
        func = all if condition_dict["operation"] == LogicalOp.AND else any
        return func(
            evaluate(child, configuration) for child in condition_dict["children"]
        )
    else:
        return configuration.get(condition_dict["id"], None) == condition_dict["value"]


def parse_condition(visibility_condition: dict | None) -> dict | None:
    """Transforms a visibility condition returned by the getConfiguration endpoint into a condition_dict."""
    if visibility_condition == None:
        return None
    elif visibility_condition["btType"] == NONE_CONDITION:
        return None

    result = {"type": visibility_condition["btType"]}
    if result["type"] == ConditionType.LOGICAL:
        result["operation"] = visibility_condition["operation"]
        children = [
            parse_condition(child) for child in visibility_condition["children"]
        ]
        result["children"] = children
    elif result["type"] == ConditionType.EQUAL:
        result["id"] = visibility_condition["parameterId"]
        result["value"] = visibility_condition["value"]
    else:
        raise ValueError(f"Unrecognized visibility condition type: {result["type"]}")
    return result


def parse_configuration(configuration: dict) -> dict:
    parameters = []
    for parameter in configuration["configurationParameters"]:
        parameter_type = parameter["btType"]
        condition_dict = parse_condition(parameter["visibilityCondition"])
        result = {
            "id": parameter["parameterId"],
            "name": parameter["parameterName"],
            "type": parameter_type,
            "visibilityCondition": condition_dict,
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

    return {"parameters": parameters}


def save_element(
    db: database.Database,
    api: Api,
    version_path: InstancePath,
    element: dict,
    preserved_info: PreservedInfo,
) -> str:
    element_type: ElementType = element["elementType"]
    element_name = element["name"]  # Use the name of the tab
    element_id = element["id"]
    path = ElementPath.from_path(version_path, element_id)

    preserved = preserved_info.load_element(element_id)

    element_db_value = {
        "name": element_name,
        "vendor": parse_vendor(element_name),
        "elementType": element_type,
        "documentId": version_path.document_id,
        "elementType": element_type,
        "isVisible": preserved["isVisible"],
    }

    configuration = get_configuration(api, path)
    if len(configuration["configurationParameters"]) > 0:
        configurations = parse_configuration(configuration)
        # Re-use element db id since configurations can't be shared
        db.configurations.document(element_id).set(configurations)
        element_db_value["configurationId"] = element_id

    db.elements.document(element_id).set(element_db_value)
    return element_id


def save_document(
    api: Api,
    db: database.Database,
    version_path: InstancePath,
    preserved_info: PreservedInfo,
) -> int:
    """Loads all of the elements of a given document into the database."""
    contents = documents.get_contents(api, version_path)

    element_ids = [
        save_element(db, api, version_path, element, preserved_info)
        for element in contents["elements"]
        if element["elementType"] in [ElementType.ASSEMBLY, ElementType.PART_STUDIO]
    ]

    document = documents.get_document(api, version_path)
    if document["documentThumbnailElementId"] == None:
        raise ValueError(
            "Document " + document["name"] + " does not have a thumbnail tab set"
        )

    document_id = version_path.document_id
    document_name = document["name"]
    db.documents.document(document_id).set(
        {
            "name": document_name,
            "instanceId": version_path.instance_id,
            "elementIds": element_ids,
        }
    )
    return len(element_ids)


def preserve_info(db: database.Database) -> PreservedInfo:
    preserved_info = PreservedInfo()
    # for doc_ref in db.documents.stream():
    #     document_id = doc_ref.id
    #     document_dict = doc_ref.to_dict()
    #     preserved_docs.save_element(document_id, document_dict)

    for element_ref in db.elements.stream():
        element_id = element_ref.id
        element_dict = element_ref.to_dict()
        preserved_info.save_element(element_id, element_dict)

    return preserved_info


@router.post("/save-all-documents")
@require_member_access()
def save_all_documents(**kwargs):
    """Saves the contents of the latest versions of all documents managed by FRC Design Lib into the database."""
    db = database.Database()
    api = connect.get_api(db)

    force = connect.get_optional_query_arg("force", False)

    with open("config.json") as file:
        config = json5.load(file)

    # Iterate in reverse so the result is ordered
    documents_list = reversed(config["documents"])

    count = 0
    visited = set()
    for document_url in documents_list:
        document_path = url_to_document_path(document_url)

        visited.add(document_path.document_id)

        latest_version_path = get_latest_version_path(api, document_path)
        document = db.documents.document(document_path.document_id).get().to_dict()
        if document == None:
            # Document doesn't exist, create it immediately
            count += save_document(api, db, latest_version_path, PreservedInfo())
            continue

        # Version is already saved
        if document.get("instanceId") == latest_version_path.instance_id and not force:
            continue

        # Refresh document
        preserved_info = preserve_info(db)
        db.delete_document(document_path.document_id)
        count += save_document(api, db, latest_version_path, preserved_info)

    # Clean up any documents that are no longer in the config
    for doc_ref in db.documents.stream():
        if doc_ref.id in visited:
            continue
        db.delete_document(doc_ref.id)

    return {"savedElements": count}


@router.post("/set-visibility" + connect.element_path_route())
@require_member_access()
def set_visibility(**kwargs):
    db = database.Database()
    element_path = connect.get_route_element_path()
    is_visible = connect.get_body_arg("isVisible")

    db.elements.document(element_path.element_id).set(
        {"isVisible": is_visible}, merge=True
    )
    return {"success": True}
