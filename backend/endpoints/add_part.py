"""Routes for inserting elements into documents."""

from enum import StrEnum
import flask

from backend.common import connect
from backend.common.app_logging import log_part_inserted
from backend.common.backend_exceptions import ClientException
from backend.common.database import ConfigurationParameters, ParameterType
from onshape_api.endpoints import part_studios, assemblies
from onshape_api.endpoints.documents import ElementType
from onshape_api.endpoints.versions import get_version
from onshape_api.paths.doc_path import ElementPath, path_to_namespace


router = flask.Blueprint("add-part", __name__)


@router.post("/add-to-assembly" + connect.element_path_route())
def add_to_assembly(**kwargs):
    """Adds the contents of an element to the current assembly."""
    db = connect.get_db()
    api = connect.get_api(db)
    assembly_path = connect.get_route_element_path()
    path_to_add = connect.get_body_element_path()
    element_type = connect.get_body_arg("elementType")
    configuration = connect.get_optional_body_arg("configuration")

    # Tracking information
    part_name = connect.get_body_arg("name")
    user_id = connect.get_body_arg("userId")
    is_favorite = connect.get_body_arg("isFavorite")

    assemblies.add_element_to_assembly(
        api, assembly_path, path_to_add, element_type, configuration=configuration
    )

    parameters = (
        None
        if configuration == None
        else db.get_configuration_parameters(path_to_add.element_id)
    )
    version = get_version(api, path_to_add)
    log_part_inserted(
        path_to_add.element_id,
        part_name,
        ElementType.ASSEMBLY,
        user_id,
        is_favorite,
        version,
        configuration,
        parameters,
    )
    return {"success": True}


@router.post("/add-to-part-studio" + connect.element_path_route())
def add_to_part_studio(**kwargs):
    """Adds the contents of an element to the current part studio."""
    db = connect.get_db()
    api = connect.get_api(db)
    part_studio_path = connect.get_route_element_path()
    path_to_add = connect.get_body_element_path()
    microversion_id = connect.get_body_arg("microversionId")
    part_name = connect.get_body_arg("name")
    configuration = connect.get_optional_body_arg("configuration")

    # Tracking information
    user_id = connect.get_body_arg("userId")
    is_favorite = connect.get_body_arg("isFavorite")

    parameters = (
        None
        if configuration == None
        else db.get_configuration_parameters(path_to_add.element_id)
    )

    derived_feature = DerivedFeature(
        part_name, path_to_add, microversion_id, configuration, parameters
    )

    part_studios.add_feature(api, part_studio_path, derived_feature.get_feature())

    version = get_version(api, path_to_add)
    log_part_inserted(
        path_to_add.element_id,
        part_name,
        ElementType.PART_STUDIO,
        user_id,
        is_favorite,
        version,
        configuration,
        parameters,
    )

    return {"success": True}


class PartStudioParameterType(StrEnum):
    """A backend-only class which is used by part studios to represent actual parameters."""

    ENUM = "BTMParameterEnum-145"
    QUANTITY = "BTMParameterQuantity-147"
    BOOLEAN = "BTMParameterBoolean-144"
    STRING = "BTMParameterString-149"


type_mapping = {
    ParameterType.ENUM: PartStudioParameterType.ENUM,
    ParameterType.QUANTITY: PartStudioParameterType.QUANTITY,
    ParameterType.BOOLEAN: PartStudioParameterType.BOOLEAN,
    ParameterType.STRING: PartStudioParameterType.STRING,
}


def config_type_to_part_studio_parameter_type(
    parameter_type: ParameterType,
) -> PartStudioParameterType:
    return type_mapping[parameter_type]


def escape_feature_name(name: str) -> str:
    return name.replace("#", "##")


class DerivedFeature:
    def __init__(
        self,
        name: str,
        part_studio_to_add: ElementPath,
        microversion_id: str,
        configuration: dict | None = None,
        parameters: ConfigurationParameters | None = None,
    ):
        self.name = escape_feature_name(name)
        self.namespace = path_to_namespace(part_studio_to_add, microversion_id)

        if configuration != None and parameters != None:
            self.part_configuration = self.build_part_configuration(
                configuration, parameters
            )

    def build_part_configuration(
        self, configuration: dict, parameters: ConfigurationParameters
    ) -> list[dict]:
        part_configuration = []
        for parameter in parameters.parameters:
            config_type: ParameterType = parameter.type
            str_value = configuration.get(parameter.id, parameter.default)
            result = {
                "btType": str(config_type_to_part_studio_parameter_type(config_type)),
                "parameterId": parameter.id,
            }
            if config_type == ParameterType.ENUM:
                result["value"] = str_value
                result["namespace"] = self.namespace
                result["enumName"] = parameter.id + "_conf"
            elif config_type == ParameterType.QUANTITY:
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
                        # Include all solid parts, mate connectors owned by parts (to allow deriving while excluding implicit mate connectors), and composite parts
                        "queryString": "query=qUnion(qAllModifiableSolidBodies(), qAllModifiableSolidBodies()->qOwnedByBody(EntityType.BODY)->qBodyType(BodyType.MATE_CONNECTOR), qAllModifiableSolidBodies()->qCompositePartsContaining());",
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
