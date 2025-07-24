import logging
from elasticsearch import Elasticsearch

from backend.common import env


def get_search_client() -> Elasticsearch:
    return Elasticsearch(
        "https://frc-design-lib-bf5b32.es.us-central1.gcp.elastic.cloud:443",
        api_key=env.search_key,
    )


class SearchIndex:
    def __init__(self, client: Elasticsearch) -> None:
        self.client = client
        self.elements_index = "elements-search"

        # document_mapping = {"properties": {"name": {"type": "text"}}}
        element_mapping = {
            "properties": {
                "name": {"type": "text"},
                "enumOptionNames": {"type": "text"},
            }
        }
        self.client.indices.put_mapping(index=self.elements_index, body=element_mapping)
        self.elements = []

    def add_element(self, id: str, name: str, enum_option_names: list[str]):
        self.client.index(
            index=self.elements_index,
            id=id,
            document={"name": name, "enumOptionNames": enum_option_names},
        )


class Search:
    def __init__(self, client: Elasticsearch):
        self.client = client

    def search_home(self, query: str) -> list[str]:
        result = self.client.search(
            index="elements-search",
            query={
                "multi_match": {
                    "query": query,
                    "fields": ["name^3", "enumOptionNames"],
                }
            },
        )
        logging.info(query)
        logging.info(result)
        hits = result["hits"]["hits"]
        return [hit["_id"] for hit in hits]

    # def search_document(self, search: str, document_id: str):
    #     return None
