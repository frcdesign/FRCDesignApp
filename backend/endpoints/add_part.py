"""Routes for inserting elements into documents."""

from enum import StrEnum
from operator import is_
import flask

from backend.common import connect
from backend.common.app_logging import APP_LOGGER, log_part_inserted
from backend.common.database import ConfigurationParameters
from backend.common.models import ParameterType
from onshape_api.endpoints import part_studios, assemblies
from onshape_api.endpoints.documents import ElementType, PartType
from onshape_api.endpoints.versions import get_version
from onshape_api.paths.doc_path import ElementPath, path_to_namespace


router = flask.Blueprint("add-part", __name__)


@router.post(
    "/add-to-assembly" + connect.library_route() + connect.element_path_route()
)
def add_to_assembly(**kwargs):
    """Adds the contents of an element to the current assembly."""
    api = connect.get_api()
    library = connect.get_route_library()
    library_ref = connect.get_library_ref()
    assembly_path = connect.get_route_element_path()
    path_to_add = connect.get_body_element_path()
    element_type = connect.get_body_arg("elementType")
    configuration = connect.get_optional_body_arg("configuration")

    fasten = connect.get_optional_body_arg("fasten", False)

    # Logging information
    part_name = connect.get_body_arg("name")
    user_id = connect.get_body_arg("userId")
    is_favorite = connect.get_body_arg("isFavorite")
    is_quick_insert = connect.get_body_arg("isQuickInsert")

    document_ref = library_ref.documents.document(path_to_add.document_id)
    element = document_ref.elements.element(path_to_add.element_id).get()

    part_types = [PartType.PARTS, PartType.COMPOSITE_PARTS]
    if element.isOpenComposite:
        part_types = [PartType.COMPOSITE_PARTS]

    assemblies.add_element_to_assembly(
        api,
        assembly_path,
        path_to_add,
        element_type,
        configuration=configuration,
        part_types=part_types,
    )

    parameters = None

    # Get the configuration for logging purposes (not needed for the actual insert)
    if configuration != None:
        parameters = (
            library_ref.documents.document(path_to_add.document_id)
            .configurations.configuration(path_to_add.element_id)
            .get()
        )

    version = get_version(api, path_to_add)
    log_part_inserted(
        path_to_add.element_id,
        part_name,
        target_element_type=ElementType.ASSEMBLY,
        user_id=user_id,
        is_favorite=is_favorite,
        is_quick_insert=is_quick_insert,
        library=library,
        version=version,
        configuration=configuration,
        configuration_parameters=parameters,
    )
    return {"success": True}


@router.post(
    "/add-to-part-studio" + connect.library_route() + connect.element_path_route()
)
def add_to_part_studio(**kwargs):
    """Adds the contents of an element to the current part studio."""
    api = connect.get_api()
    library = connect.get_route_library()
    library_ref = connect.get_library_ref()

    part_studio_path = connect.get_route_element_path()
    path_to_add = connect.get_body_element_path()

    microversion_id = connect.get_body_arg("microversionId")
    part_name = connect.get_body_arg("name")
    configuration = connect.get_optional_body_arg("configuration")

    # Tracking information
    user_id = connect.get_body_arg("userId")
    is_favorite = connect.get_body_arg("isFavorite")
    is_quick_insert = connect.get_body_arg("isQuickInsert")

    document_ref = library_ref.documents.document(path_to_add.document_id)

    parameters = None
    if configuration != None:
        parameters = document_ref.configurations.configuration(
            path_to_add.element_id
        ).get()

    derived_feature = DerivedFeature(
        part_name, path_to_add, microversion_id, configuration, parameters
    )

    part_studios.add_feature(api, part_studio_path, derived_feature.get_feature())

    version = get_version(api, path_to_add)
    log_part_inserted(
        path_to_add.element_id,
        part_name,
        target_element_type=ElementType.PART_STUDIO,
        user_id=user_id,
        is_favorite=is_favorite,
        is_quick_insert=is_quick_insert,
        library=library,
        version=version,
        configuration=configuration,
        configuration_parameters=parameters,
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
        else:
            self.part_configuration = None

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
