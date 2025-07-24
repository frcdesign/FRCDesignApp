from elasticsearch import Elasticsearch

from backend.common import env
from onshape_api.paths.instance_type import InstanceType


def get_search_client() -> Elasticsearch:
    return Elasticsearch(
        "https://frc-design-lib-bf5b32.es.us-central1.gcp.elastic.cloud:443",
        api_key=env.search_key,
    )


class SearchIndex:
    def __init__(self, client: Elasticsearch) -> None:
        self.client = client

        self.documents_index = "documents-search"
        self.elements_index = "elements-search"

        # Create name and name.raw depending on if you want text for searching or keyword for sorting
        document_mapping = {
            "properties": {
                "name": {"type": "text", "fields": {"keyword": {"type": "keyword"}}}
            }
        }
        element_mapping = {
            "properties": {
                "name": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
                "configurationOptions": {"type": "text"},
            }
        }
        self.client.indices.put_mapping(
            index=self.documents_index, body=document_mapping
        )
        self.client.indices.put_mapping(index=self.elements_index, body=element_mapping)

        self.elements = []
        self.documents = []

    def add_document(self, id: str, name: str):
        self.client.index(index=self.documents_index, id=id, document={"name": name})

    def add_element(self, id: str, name: str, configuration_values: list[str]):
        self.client.index(
            index=self.elements_index,
            id=id,
            document={"name": name, "configurationOptions": configuration_values},
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
                    "fields": ["title^3", "configurationOptions"],
                }
            },
        )
        hits = result["hits"]["hits"]
        return [hit["_id"] for hit in hits]

    # def search_document(self, search: str, document_id: str):
    #     return None
