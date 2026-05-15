from backend.common.models import FastenInfo, MateLocation
from backend.endpoints.add_part import ParseFastenInfo

ASSEMBLY_MATE_CONNECTOR_MOCK = {
    "rootAssembly": {
        "occurrences": [],
        "instances": [],
        "patterns": [],
        "features": [
            {
                "id": "mate-connector-id",
                "featureType": "mateConnector",
                "featureData": {
                    "mateConnectorCS": {
                        "xAxis": [1, 0, 0],
                        "yAxis": [0, 1, 0],
                        "zAxis": [0, 0, 1],
                        "origin": [0, 0, 0],
                    },
                    "occurrence": [],
                    "name": "Mate connector 1",
                },
            }
        ],
    },
    "subAssemblies": [],
    "parts": [],
    "partStudioFeatures": [],
}


SUB_ASSEMBLY_MOCK = {
    "rootAssembly": {
        "occurrences": [],
        "instances": [
            {
                "id": "instance-id",
                "type": "Assembly",
                "name": "Assembly 1 <1>",
                "suppressed": False,
                "fullConfiguration": "default",
                "configuration": "default",
                "documentId": "d351931fbe8de9ebe5271d9f",
                "elementId": "71bcf425f9c0677d2047c23a",
                "documentMicroversion": "0ba59faf5d596cede855ed48",
            }
        ],
        "patterns": [],
        "features": [],
    },
    "subAssemblies": [
        {
            "instances": [],
            "patterns": [],
            "features": [
                {
                    "id": "mate-connector-id",
                    "suppressed": False,
                    "featureType": "mateConnector",
                    "featureData": {
                        "mateConnectorCS": {
                            "xAxis": [1, 0, 0],
                            "yAxis": [0, 1, 0],
                            "zAxis": [0, 0, 1],
                            "origin": [0, 0, 0],
                        },
                        "occurrence": [],
                        "name": "Mate connector 1",
                    },
                }
            ],
            "fullConfiguration": "default",
            "configuration": "default",
            "documentId": "d351931fbe8de9ebe5271d9f",
            "elementId": "71bcf425f9c0677d2047c23a",
            "documentMicroversion": "0ba59faf5d596cede855ed48",
        }
    ],
    "parts": [],
    "partStudioFeatures": [],
}

PART_MOCK = {
    "rootAssembly": {
        "occurrences": [],
        "instances": [
            {
                "isStandardContent": False,
                "id": "part-id",
                "type": "Part",
                "name": "Part 1 <1>",
                "suppressed": False,
                "partId": "JHD",
                "fullConfiguration": "default",
                "configuration": "default",
                "documentId": "d351931fbe8de9ebe5271d9f",
                "elementId": "eda10a261620ce6a53fdb300",
                "documentMicroversion": "e22361cad633ad1723933731",
            }
        ],
        "patterns": [],
        "features": [],
    },
    "subAssemblies": [],
    "parts": [
        {
            "isStandardContent": False,
            "partId": "JHD",
            "bodyType": "solid",
            "mateConnectors": [
                {
                    "mateConnectorCS": {
                        "xAxis": [1, 0, 0],
                        "yAxis": [0, 1, 0],
                        "zAxis": [0, 0, 1],
                        "origin": [0, 0, 0],
                    },
                    "featureId": "mate-connector-id",
                }
            ],
        }
    ],
    "partStudioFeatures": [],
}

PART_STUDIO_MOCK = {
    "btType": "BTFeatureListResponse-2457",
    "serializationVersion": "1.2.13",
    "isComplete": True,
    "rollbackIndex": 3,
    "features": [
        {
            "btType": "BTMFeature-134",
            "namespace": "",
            "name": "Mate connector 1",
            "suppressed": False,
            "parameters": [],
            "featureId": "mate-connector-id",
            "featureType": "mateConnector",
            "returnAfterSubfeatures": False,
            "subFeatures": [],
            "suppressionState": None,
            "parameterLibraries": [],
        }
    ],
    "sourceMicroversion": "e22361cad633ad1723933731",
    "microversionSkew": False,
    "rejectMicroversionSkew": False,
    "libraryVersion": 2796,
    "featureStates": {},
    "defaultFeatures": [],
    "imports": [],
}


def test_assembly_mate_connector():
    fasten_info = ParseFastenInfo().get_fasten_info_from_assembly(
        ASSEMBLY_MATE_CONNECTOR_MOCK
    )
    expected = FastenInfo(
        mateConnectorId="mate-connector-id",
        mateLocation=MateLocation.FEATURE,
        path=[],
    )
    assert fasten_info.model_dump() == expected.model_dump()


def test_sub_assembly():
    fasten_info = ParseFastenInfo().get_fasten_info_from_assembly(SUB_ASSEMBLY_MOCK)
    expected = FastenInfo(
        mateConnectorId="mate-connector-id",
        mateLocation=MateLocation.SUBASSEMBLY,
        path=["instance-id"],
    )
    assert fasten_info.model_dump() == expected.model_dump()


def test_part():
    fasten_info = ParseFastenInfo().get_fasten_info_from_assembly(PART_MOCK)
    expected = FastenInfo(
        mateConnectorId="mate-connector-id",
        mateLocation=MateLocation.PART,
        path=["part-id"],
    )
    assert fasten_info.model_dump() == expected.model_dump()


def test_part_studio():
    fasten_info = ParseFastenInfo().get_fasten_info_from_part_studio(PART_STUDIO_MOCK)
    expected = FastenInfo(
        mateConnectorId="mate-connector-id",
        mateLocation=MateLocation.FEATURE,
        path=[],
    )
    assert fasten_info.model_dump() == expected.model_dump()
