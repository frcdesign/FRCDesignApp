from __future__ import annotations
from dataclasses import dataclass
from typing import Generic, Type, TypeVar

from google.cloud import firestore
from google.cloud.firestore import CollectionReference, DocumentReference
from pydantic import BaseModel, ValidationError

from backend.common.models import (
    ConfigurationParameters,
    Document,
    Element,
    Favorite,
    LibraryData,
    LibraryType,
    UserData,
)

T = TypeVar("T", bound=BaseModel)


class FirestoreCollection(Generic[T]):
    """Represents a collection of Firestore documents."""

    def __init__(self, ref: CollectionReference, model: Type[T]):
        self.ref = ref
        self.model = model

    def document(self, doc_id: str) -> FirestoreDocument[T]:
        return FirestoreDocument(self.ref.document(doc_id), self.model)

    def list(self) -> list[T]:
        result = []
        for document_ref in self.ref.stream():
            data = FirestoreDocument(document_ref, self.model).get()
            if data:
                result.append(data)

        return result

    def set(self, doc_id: str, data: T):
        self.ref.document(doc_id).set(data.model_dump())

    def delete(self, doc_id: str):
        self.ref.document(doc_id).delete()


class FirestoreDocument(Generic[T]):
    def __init__(self, ref: DocumentReference, model: Type[T]):
        self.ref = ref
        self.model = model

    def get(self) -> T | None:
        snap = self.ref.get()
        if not snap.exists:
            return None
        try:
            return self.model.model_validate(snap.to_dict())
        except ValidationError:
            return None

    def set(self, data: T):
        self.ref.set(data.model_dump())

    def delete(self):
        self.ref.delete()


@dataclass
class LibraryRef:
    ref: DocumentReference

    def data(self) -> FirestoreDocument[LibraryData]:
        return FirestoreDocument(self.ref, LibraryData)

    def document_ref(self, document_id: str) -> DocumentRef:
        return DocumentRef(self.ref.collection("documents").document(document_id))

    def user_ref(self, user_id: str) -> UserDataRef:
        return UserDataRef(self.ref.collection("userData").document(user_id))


@dataclass
class UserDataRef:
    ref: DocumentReference

    def data(self) -> FirestoreDocument[UserData]:
        return FirestoreDocument(self.ref, UserData)

    def favorites(self) -> FirestoreCollection[Favorite]:
        return FirestoreCollection(self.ref.collection("favorites"), Favorite)

    def favorite(self, favorite_id: str) -> FirestoreDocument[Favorite]:
        return self.favorites().document(favorite_id)


@dataclass
class DocumentRef:
    ref: DocumentReference

    def document(self) -> FirestoreDocument[Document]:
        return FirestoreDocument(self.ref, Document)

    def elements(self) -> FirestoreCollection[Element]:
        return FirestoreCollection(self.ref.collection("elements"), Element)

    def element(self, element_id: str) -> FirestoreDocument[Element]:
        return self.elements().document(element_id)

    def configurations(self) -> FirestoreCollection[ConfigurationParameters]:
        return FirestoreCollection(
            self.ref.collection("configurations"), ConfigurationParameters
        )

    def configuration(
        self, configuration_id: str
    ) -> FirestoreDocument[ConfigurationParameters]:
        return self.configurations().document(configuration_id)


class Database:
    def __init__(self, client: firestore.Client):
        self.client = client

    def library(self, library: LibraryType) -> LibraryRef:
        libraries = self.client.collection("libraries")
        return LibraryRef(libraries.document(library))

    @property
    def sessions(self) -> CollectionReference:
        return self.client.collection("sessions")


# def delete_collection(coll_ref: CollectionReference, batch_size=500):
#     """Deletes a collection in the database."""
#     if batch_size == 0:
#         return

#     docs = coll_ref.list_documents(page_size=batch_size)
#     deleted = 0

#     for doc in docs:
#         doc.delete()
#         deleted = deleted + 1

#     if deleted >= batch_size:
#         return delete_collection(coll_ref, batch_size)
