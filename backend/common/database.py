from google.cloud import firestore
from google.cloud.firestore import CollectionReference

from onshape_api.paths.instance_type import InstanceType
from onshape_api.paths.paths import ElementPath


class Database:
    def __init__(self):
        self.db = firestore.Client()

    @property
    def sessions(self) -> CollectionReference:
        return self.db.collection("sessions")

    @property
    def documents(self) -> CollectionReference:
        return self.db.collection("documents")

    @property
    def elements(self) -> CollectionReference:
        return self.db.collection("elements")

    @property
    def configurations(self) -> CollectionReference:
        return self.db.collection("configurations")

    def delete_document(self, document_id: str):
        """Deletes a document and all elements and configurations which depend on it."""
        element = self.documents.document(document_id).get().to_dict()
        if element == None:
            return
        for element_id in element.get("elementIds", []):
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
