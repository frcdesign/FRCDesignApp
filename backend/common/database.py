from __future__ import annotations

from google.cloud import firestore
from google.cloud.firestore import CollectionReference, DocumentReference

from backend.common.models import ConfigurationParameters, UserData
from onshape_api.paths.user_path import UserPath


class Database:
    def __init__(self, client: firestore.Client):
        self.client = client

    @property
    def cache(self) -> DocumentReference:
        return self.client.collection("common").document("cache")

    @property
    def sessions(self) -> CollectionReference:
        return self.client.collection("sessions")

    @property
    def documents(self) -> CollectionReference:
        return self.client.collection("documents")

    @property
    def elements(self) -> CollectionReference:
        return self.client.collection("elements")

    @property
    def user_data(self) -> CollectionReference:
        return self.client.collection("userData")

    def get_user_data(self, user_path: UserPath) -> UserData:
        return UserData.model_validate(
            self.user_data.document(user_path.user_id).get().to_dict() or {}
        )

    def set_user_data(self, user_path: UserPath, user_data: UserData) -> None:
        self.user_data.document(user_path.user_id).set(user_data.model_dump())

    @property
    def configurations(self) -> CollectionReference:
        return self.client.collection("configurations")

    def get_configuration_parameters(
        self, configuration_id: str
    ) -> ConfigurationParameters:
        parameters = self.configurations.document(configuration_id).get().to_dict()
        if parameters == None:
            raise ValueError(f"Failed to find configuration with id {configuration_id}")

        return ConfigurationParameters.model_validate(parameters)

    @property
    def document_order(self) -> DocumentReference:
        return self.client.collection("common").document("documentOrder")

    def get_document_order(self) -> list[str]:
        result = self.document_order.get().to_dict()
        if result == None:
            return []
        # We have to nest to satisfy Google Cloud
        return result.get("documentOrder", [])

    def set_document_order(self, order: list[str]) -> None:
        self.document_order.set({"documentOrder": order})

    def delete_document(self, document_id: str):
        """Deletes a document and all elements and configurations which depend on it."""
        document = self.documents.document(document_id).get().to_dict()
        self.documents.document(document_id).delete()

        if document == None:
            return
        # Delete all children as well
        for element_id in document.get("elementIds", []):
            self.elements.document(element_id).delete()
            self.configurations.document(element_id).delete()


def delete_collection(coll_ref: CollectionReference, batch_size=500):
    """Deletes a collection in the database."""
    if batch_size == 0:
        return

    docs = coll_ref.list_documents(page_size=batch_size)
    deleted = 0

    for doc in docs:
        doc.delete()
        deleted = deleted + 1

    if deleted >= batch_size:
        return delete_collection(coll_ref, batch_size)
