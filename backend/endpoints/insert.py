"""Routes for inserting elements into documents."""

import flask

from backend.common import connect
from backend.common.backend_exceptions import (
    ClientException,
)
from backend.endpoints.backend_types import (
    ConfigurationType,
    config_type_to_parameter_type,
)
from onshape_api.endpoints import part_studios
from onshape_api.endpoints.assemblies import add_element_to_assembly
from onshape_api.paths.doc_path import ElementPath, path_to_namespace

router = flask.Blueprint("insert", __name__)


@router.post("/add-to-assembly" + connect.element_path_route())
def add_to_assembly(**kwargs):
    """Adds the contents of an element to the current assembly."""
    db = connect.get_db()
    api = connect.get_api(db)
    assembly_path = connect.get_route_element_path()
    path_to_add = connect.get_body_element_path()
    element_type = connect.get_body_arg("elementType")
    configuration = connect.get_optional_body_arg("configuration")

    add_element_to_assembly(
        api, assembly_path, path_to_add, element_type, configuration=configuration
    )
    return {"success": True}


@router.post("/add-to-part-studio" + connect.element_path_route())
def add_to_part_studio(**kwargs):
    """Adds the contents of an element to the current part studio."""
    db = connect.get_db()
    api = connect.get_api(db)
    part_studio_path = connect.get_route_element_path()
    part_studio_to_add = connect.get_body_element_path()
    microversion_id = connect.get_body_arg("microversionId")
    part_name = connect.get_body_arg("name")
    configuration = connect.get_body_arg("configuration")

    if configuration != None:
        parameters = (
            db.configurations.document(part_studio_to_add.element_id).get().to_dict()
        )
        if parameters == None:
            raise ClientException("Failed to find configuration parameters")

    derived_feature = DerivedFeature(
        part_name, part_studio_to_add, microversion_id, configuration, parameters
    )

    part_studios.add_feature(api, part_studio_path, derived_feature.get_feature())

    return {"success": True}


class DerivedFeature:
    def __init__(
        self,
        name: str,
        part_studio_to_add: ElementPath,
        microversion_id: str,
        configuration: dict | None = None,
        parameters: dict | None = None,
    ):
        self.name = name
        self.namespace = path_to_namespace(part_studio_to_add, microversion_id)

        if configuration != None and parameters != None:
            self.part_configuration = self.build_part_configuration(
                configuration, parameters
            )

    def build_part_configuration(
        self, configuration: dict, parameters: dict
    ) -> list[dict]:
        part_configuration = []
        for parameter in parameters["parameters"]:
            config_type: ConfigurationType = parameter["type"]
            str_value = configuration[parameter["id"]]
            result = {
                "btType": str(config_type_to_parameter_type(config_type)),
                "parameterId": parameter["id"],
            }
            if config_type == ConfigurationType.ENUM:
                result["value"] = str_value
                result["namespace"] = self.namespace
                result["enumName"] = parameter["id"] + "_conf"
            elif config_type == ConfigurationType.QUANTITY:
                result["expression"] = str_value
            else:
                result["value"] = str_value

            part_configuration.append(result)

        return part_configuration

    def get_feature(self) -> dict:
        part_studio_parameter = {
            "btType": "BTMParameterReferencePartStudio-3302",
            "partQuery": {
                "btType": "BTMParameterQueryList-148",
                "queries": [
                    {
                        "btType": "BTMIndividualQuery-138",
                        "queryString": "query=qUnion(qAllModifiableSolidBodies(), qAllModifiableSolidBodies()->qOwnedByBody(EntityType.BODY)->qBodyType(BodyType.MATE_CONNECTOR));",
                    }
                ],
                "parameterId": "partQuery",
            },
            "namespace": self.namespace,
            "parameterId": "partStudio",
        }

        if self.part_configuration:
            part_studio_parameter["configuration"] = self.part_configuration

        return {
            "btType": "BTMFeature-134",
            "name": self.name,
            "featureType": "importDerived",
            "parameters": [
                part_studio_parameter,
                {
                    "btType": "BTMParameterBoolean-144",
                    "value": False,
                    "parameterId": "includeMateConnectors",
                },
            ],
        }
