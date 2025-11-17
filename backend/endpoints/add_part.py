"""Routes for inserting elements into documents."""

from enum import StrEnum
import flask

from backend.common import connect
from backend.common.app_access import require_access_level
from backend.common.app_logging import log_part_inserted
from backend.common.backend_exceptions import HandledException
from backend.common.database import ConfigurationParameters
from backend.common.models import FastenInfo, MateLocation, ParameterType
from onshape_api.api.api_base import Api
from onshape_api.endpoints import part_studios, assemblies
from onshape_api.endpoints.documents import ElementType, PartType
from onshape_api.model.assembly_features import (
    FastenMateBuilder,
    feature_occurrence_query,
    part_studio_mate_connector_query,
)
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
    target_path = connect.get_route_element_path()
    path_to_add = connect.get_body_element_path()
    configuration = connect.get_optional_body_arg("configuration")

    fasten = connect.get_optional_body_arg("fasten", False)

    # Logging information
    user_id = connect.get_body_arg("userId")
    is_favorite = connect.get_body_arg("isFavorite")
    is_quick_insert = connect.get_body_arg("isQuickInsert")

    document_ref = library_ref.documents.document(path_to_add.document_id)

    element = document_ref.elements.element(path_to_add.element_id).get()

    part_types = [PartType.PARTS, PartType.COMPOSITE_PARTS]
    if element.isOpenComposite:
        part_types = [PartType.COMPOSITE_PARTS]

    result = assemblies.add_element_to_assembly(
        api,
        target_path,
        path_to_add,
        element.elementType,
        configuration=configuration,
        part_types=part_types,
        use_transform=fasten,
    )

    feature_id = None
    if fasten:
        fasten_info = element.fastenInfo
        if fasten_info == None:
            raise HandledException(
                f"Failed to create Fasten feature: {element.name} does not support fastening."
            )

        instance_path = result["insertInstanceResponses"][0]["occurrences"][0]["path"]

        fasten_mate = FastenMateBuilder(element.name)
        if element.elementType == ElementType.PART_STUDIO:
            fasten_mate.add_query(
                part_studio_mate_connector_query(
                    feature_id=fasten_info.mateConnectorId,
                    path=instance_path,
                )
            )
        else:
            if fasten_info.mateLocation == MateLocation.PART:
                fasten_mate.add_query(
                    part_studio_mate_connector_query(
                        feature_id=fasten_info.mateConnectorId,
                        path=instance_path + fasten_info.path,
                    )
                )
            elif (
                fasten_info.mateLocation == MateLocation.FEATURE
                or fasten_info.mateLocation == MateLocation.SUBASSEMBLY
            ):
                fasten_mate.add_query(
                    feature_occurrence_query(
                        feature_id=fasten_info.mateConnectorId,
                        path=instance_path + fasten_info.path,
                    )
                )

        fasten_mate_result = assemblies.add_feature(
            api, target_path, fasten_mate.build()
        )
        feature_id = fasten_mate_result["feature"]["featureId"]

    # Get the configuration parameters for logging purposes (not needed for the actual insert)
    parameters = None
    if configuration != None:
        parameters = document_ref.configurations.configuration(
            path_to_add.element_id
        ).get()

    document = document_ref.get()

    log_part_inserted(
        path_to_add.element_id,
        element.name,
        target_element_type=ElementType.ASSEMBLY,
        user_id=user_id,
        is_favorite=is_favorite,
        is_quick_insert=is_quick_insert,
        library=library,
        document=document,
        configuration=configuration,
        configuration_parameters=parameters,
        supports_fasten=element.fastenInfo != None,
        fasten=fasten,
    )
    return {"success": True, "featureId": feature_id}


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

    use_mate_connector = connect.get_optional_body_arg("useMateConnector", False)

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
        name=part_name,
        part_studio_to_add=path_to_add,
        microversion_id=microversion_id,
        use_mate_connector=use_mate_connector,
        configuration=configuration,
        parameters=parameters,
    )
    response = part_studios.add_feature(
        api, part_studio_path, derived_feature.get_feature()
    )

    log_part_inserted(
        path_to_add.element_id,
        part_name,
        target_element_type=ElementType.PART_STUDIO,
        user_id=user_id,
        is_favorite=is_favorite,
        is_quick_insert=is_quick_insert,
        library=library,
        document=document_ref.get(),
        configuration=configuration,
        configuration_parameters=parameters,
    )

    return {"success": True, "featureId": response["feature"]["featureId"]}


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
    """Escapes # characters in a feature name so Onshape doesn't treat them as variable declarations.

    Only needed in Part Studios since only Part Studio features can have variables in their name.
    """
    return name.replace("#", "##")


class DerivedFeature:
    def __init__(
        self,
        name: str,
        part_studio_to_add: ElementPath,
        microversion_id: str,
        use_mate_connector: bool = False,
        configuration: dict | None = None,
        parameters: ConfigurationParameters | None = None,
    ):
        """

        Parameters:
            use_mate_connector: Whether to include mate connectors when deriving the part studio.
        """
        self.name = escape_feature_name(name)
        self.namespace = path_to_namespace(part_studio_to_add, microversion_id)
        self.use_mate_connector = use_mate_connector

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

        placement = {
            "btType": "BTMParameterEnum-145",
            "enumName": "DerivedPlacementType",
            "value": "AT_MATE_CONNECTOR" if self.use_mate_connector else "AT_ORIGIN",
            "parameterId": "placement",
        }

        include_mate_connectors = {
            "btType": "BTMParameterBoolean-144",
            "value": False,
            "parameterId": "includeMateConnectors",
        }

        return {
            "btType": "BTMFeature-134",
            "name": self.name,
            "featureType": "importDerived",
            "parameters": [
                part_studio_parameter,
                placement,
                include_mate_connectors,
            ],
        }


@router.post("/is-open-composite" + connect.library_route())
@require_access_level()
def set_element_open_composite(**kwargs):
    library_ref = connect.get_library_ref()
    document_id = connect.get_body_arg("documentId")
    element_id = connect.get_body_arg("elementId")
    is_open_composite = connect.get_body_arg("isOpenComposite")

    element_ref = library_ref.documents.document(document_id).elements.element(
        element_id
    )
    element_ref.update({"isOpenComposite": is_open_composite})

    return {"success": True}


@router.post(
    "/supports-fasten" + connect.library_route() + connect.element_path_route()
)
@require_access_level()
def set_element_supports_fasten(**kwargs):
    api = connect.get_api()
    library_ref = connect.get_library_ref()
    element_path = connect.get_route_element_path()
    supports_fasten = connect.get_body_arg("supportsFasten")

    element_ref = library_ref.documents.document(
        element_path.document_id
    ).elements.element(element_path.element_id)

    if supports_fasten:
        element = element_ref.get()
        element.fastenInfo = ParseFastenInfo().get_fasten_info(
            api, element_path, element.elementType
        )
        element_ref.set(element)
    else:
        element_ref.update({"fastenInfo": None})

    return {"success": True}


class ParseFastenInfo:
    def get_fasten_info(
        self, api: Api, element_path: ElementPath, element_type: ElementType
    ) -> FastenInfo:
        if element_type == ElementType.PART_STUDIO:
            feature_list = part_studios.get_features(api, element_path)
            return self.get_fasten_info_from_part_studio(feature_list)
        else:
            assembly_info = assemblies.get_assembly(
                api,
                element_path,
                include_mate_connectors=True,
                include_mate_features=True,
            )
            return self.get_fasten_info_from_assembly(assembly_info)

    def get_fasten_info_from_part_studio(self, feature_list: dict) -> FastenInfo:
        for feature in feature_list["features"]:
            if feature["featureType"] == "mateConnector":
                return FastenInfo(
                    mateConnectorId=feature["featureId"],
                    mateLocation=MateLocation.FEATURE,
                )
        raise HandledException("Failed to find a valid Mate connector feature.")

    def get_fasten_info_from_assembly(self, assembly_info: dict) -> FastenInfo:
        root_assembly = assembly_info["rootAssembly"]

        fasten_info = self.search_features(
            root_assembly["features"], mate_location=MateLocation.FEATURE
        )
        if fasten_info != None:
            return fasten_info

        parts = assembly_info["parts"]
        sub_assemblies = assembly_info["subAssemblies"]

        part_counter = 0
        sub_assembly_counter = 0

        # Loop over each instance and grab the corresponding part or subAssembly
        # Onshape doesn't include the occurrence path in parts/sub assemblies, so we rely on the order being consistent
        # This is fragile, but Onshape doesn't provide a better way to do this currently
        for instance in root_assembly["instances"]:
            path = [instance["id"]]
            if instance["type"] == "Part":
                part = parts[part_counter]
                part_counter += 1

                mate_connectors = part.get("mateConnectors", [])
                if len(mate_connectors) > 0:
                    return FastenInfo(
                        mateConnectorId=mate_connectors[0]["featureId"],
                        path=path,
                        mateLocation=MateLocation.PART,
                    )
            elif instance["type"] == "Assembly":
                sub_assembly = sub_assemblies[sub_assembly_counter]
                sub_assembly_counter += 1
                fasten_info = self.search_features(
                    sub_assembly["features"],
                    path=path,
                    mate_location=MateLocation.SUBASSEMBLY,
                )
                if fasten_info != None:
                    return fasten_info

        raise HandledException(
            "Failed to find a valid Mate connector feature or Instance with a Mate connector."
        )

    def search_features(
        self,
        features: list[dict],
        mate_location: MateLocation,
        path: list[str] = [],
    ) -> FastenInfo | None:
        for feature in features:
            if feature["featureType"] == "mateConnector":
                path = path.copy()  # Don't mutate default list
                path += feature["featureData"]["occurrence"]
                return FastenInfo(
                    mateConnectorId=feature["id"],
                    mateLocation=mate_location,
                    path=path,
                )
        return None
