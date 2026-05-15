"""Utilities with working with queries in part studios and assemblies."""
from onshape_api.utils import str_utils

__all__ = ["parse_query"]

# { queryType : UNION , subqueries : [ { disambiguationData : [ { disambiguationType : ORIGINAL_DEPENDENCY , originals : [ { entityType : EDGE , historyType : CREATION , operationId : [ F86ylNPrzWLomm9_1.wireOp ] , queryType : SKETCH_ENTITY , sketchEntityId : rGNlyQ5ipaBS } ] } ] , entityType : EDGE , historyType : CREATION , isStart : false , operationId : [ FHCYmesA2a3t0Lm_1.opExtrude ] , queryType : CAP_EDGE } ] }

# query=makeQuery(makeId(\"FHCYmesA2a3t0Lm_1.opExtrude\"), \"CAP_EDGE\", EntityType.EDGE, { \"isStart\" : false, \"disambiguationData\" : [{ \"disambiguationType\" : \"ORIGINAL_DEPENDENCY\", \"originals\" : [makeQuery(makeId(\"F86ylNPrzWLomm9_1.wireOp\"), \"SKETCH_ENTITY\", EntityType.EDGE, { \"sketchEntityId\" : \"rGNlyQ5ipaBS\" })] } ] });


def entity_type(type: str) -> str:
    return "EntityType.{}".format(type)


def parse_id(id: list) -> str:
    return "makeId({})".format(str_utils.quote(id[0]))


def parse_list(values: list) -> str:
    return ", ".join(parse_query(value) for value in values)


def parse_query_value(key: str, value) -> str:
    # if key == "queryType":
    #     return str_utils.quote(value)
    if key == "operationId":
        return parse_id(value)
    elif key == "entityType":
        return "EntityType.{}".format(value)
    elif isinstance(value, list):
        return "[{}]".format(parse_list(value))

    if value == "true" or value == "false":
        return value
    return str_utils.quote(value)


def parse_query(query: dict) -> str:
    """Parses a query into a format consumable by the Onshape API."""
    if query.get("queryType") == "UNION":
        subqueries = ", ".join(
            [parse_query(subquery) for subquery in query["subqueries"]]
        )
        return "qUnion([{}])".format(subqueries)

    result_map = ", ".join(
        "{} : {}".format(str_utils.quote(key), parse_query_value(key, value))
        for key, value in query.items()
    )

    if query.get("queryType") == None:
        return result_map
    return "makeQuery({{ {} }})".format(result_map)
