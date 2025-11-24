"""Utilities and functions for working with assembly features."""

from typing import Iterable, Self


def dummy_id():
    """A dummy id which allows features to bypass validation."""
    return "0" * 17


def part_studio_mate_connector_query(feature_id: str, path: list[str] = []) -> dict:
    """A query for a mate connector feature in a part studio."""
    return {
        "btType": "BTMPartStudioMateConnectorQuery-1324",
        "featureId": feature_id,
        "path": path,
    }


def individual_occurrence_query(path: list[str]) -> dict:
    """A query for a specific instance."""
    return {
        "btType": "BTMIndividualOccurrenceQuery-626",
        "path": path,
    }


def feature_occurrence_query(
    feature_id: str, path: list[str] = [], query_data: str = ""
) -> dict:
    """A query for a feature in an assembly."""
    return {
        "btType": "BTMFeatureQueryWithOccurrence-157",
        "path": path,
        "queryData": query_data,
        "featureId": feature_id,
    }


ORIGIN_QUERY = feature_occurrence_query(feature_id="Origin", query_data="ORIGIN_Z")


class FastenMateBuilder:
    """A fasten mate builder."""

    def __init__(self, name: str, queries: Iterable[dict] = []) -> None:
        """
        Args:
            queries: A tuple of two queries to use. Note Onshape has a tendency to preserve the location of the second query in cases where neither instance is constrained.
        """
        self.name = name
        self.mate_connectors = []
        self.queries = list(queries)

    def add_query(self, query: dict) -> Self:
        """Add a query to the fasten mate."""
        self.queries.append(query)
        return self

    def add_mate_connector(self, mate_connector: dict) -> Self:
        """
        Adds a user-editable mate connector plus an implicit mate connector sub feature to the feature.
        """
        mate_id = dummy_id()
        mate_connector["featureId"] = mate_id
        self.mate_connectors.append(mate_connector)
        self.queries.append(feature_occurrence_query(mate_id))
        return self

    def build(self) -> dict:
        return fasten_mate(self.name, self.queries, self.mate_connectors)


def fasten_mate(
    name: str, queries: Iterable[dict], mate_connectors: Iterable[dict] | None = None
) -> dict:
    """A fasten mate.

    Args:
        queries: A tuple of up to two queries to fasten.
                Note Onshape has a tendency to preserve the location of the second query in cases where neither instance is constrained.
        mate_connectors: A list of Implicit mate connectors owned by the feature.
    """
    fasten_mate = {
        "btType": "BTMMate-64",
        "featureType": "mate",
        "name": name,
        "parameters": [
            mate_type_parameter("FASTENED"),
            query_parameter("mateConnectorsQuery", queries),
        ],
    }
    # Avoid adding None
    if mate_connectors:
        fasten_mate["mateConnectors"] = mate_connectors
    return fasten_mate


def query_parameter(parameter_id: str, queries: Iterable[dict]) -> dict:
    return {
        "btType": "BTMParameterQueryWithOccurrenceList-67",
        "parameterId": parameter_id,
        "queries": queries,
    }


def mate_type_parameter(value: str) -> dict:
    return {
        "btType": "BTMParameterEnum-145",
        "parameterId": "mateType",
        "value": value,
        "enumName": "Mate type",
    }


def primary_axis_parameter(parameter_id: str, value: bool = False) -> dict:
    return {
        "btType": "BTMParameterBoolean-144",
        "parameterId": parameter_id,
        "value": value,
    }


def group_mate(name: str, queries: Iterable[dict]) -> dict:
    """A group mate."""
    return {
        "btType": "BTMMateGroup-65",
        "name": name,
        "featureType": "mateGroup",
        "parameters": [query_parameter("occurrencesQuery", queries)],
    }


def mate_connector(name: str, originQuery: dict, implicit: bool = False) -> dict:
    """A mate connector feature."""

    return {
        "btType": "BTMMateConnector-66",
        "name": name,
        "implicit": implicit,
        "parameters": [
            {
                "btType": "BTMParameterEnum-145",
                "value": "ON_ENTITY",
                "enumName": "Origin type",
                "parameterId": "originType",
            },
            query_parameter("originQuery", [originQuery]),
        ],
    }


def implicit_mate_connector(originQuery: dict) -> dict:
    """A mate connector which is owned by another mate."""
    return mate_connector("Mate connector", originQuery, implicit=True)
