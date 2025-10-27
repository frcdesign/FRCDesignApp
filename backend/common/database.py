from __future__ import annotations
from enum import StrEnum
from typing import Generic, Type, TypeVar, override

from google.cloud import firestore
from google.cloud.firestore import CollectionReference, DocumentReference
from pydantic import BaseModel, ValidationError

from backend.common.backend_exceptions import ServerException
from backend.common.models import (
    Document,
    Element,
    Favorite,
    Library,
    LibraryData,
    LibraryUserData,
)


class Collection(StrEnum):
    LIBRARIES = "libraries"
    DOCUMENTS = "documents"
    ELEMENTS = "elements"
    LIBRARY_USER_DATA = "libraryUserData"
    FAVORITES = "favorites"
    USER_DATA = "userData"
    SESSIONS = "sessions"


T = TypeVar("T", bound=BaseModel)


class FirestoreCollection(Generic[T]):
    """A collection of Firestore documents."""

    def __init__(
        self,
        ref: CollectionReference,
        model: Type[T],
    ):
        self.ref = ref
        self.model = model

    def child(self, doc_id: str) -> FirestoreDocument[T]:
        return FirestoreDocument(self.ref.document(doc_id), self.model)

    def keys(self) -> list[str]:
        return [doc_ref.id for doc_ref in self.list()]

    def get(self, doc_id: str) -> T | None:
        return self.child(doc_id).get()

    def list(self) -> list[FirestoreDocument[T]]:
        return [FirestoreDocument(doc_ref, self.model) for doc_ref in self.ref.stream()]

    def set(self, doc_id: str, data: T):
        self.ref.document(doc_id).set(data.model_dump())

    def delete(self, doc_id: str):
        self.ref.document(doc_id).delete()


D = TypeVar("D", bound=BaseModel)


class OrderedCollection(FirestoreCollection[T], Generic[D, T]):
    """A Firestore collection that maintains an explicit order list in its parent document."""

    def __init__(
        self,
        collection_ref: CollectionReference,
        document_model: Type[D],
        model: Type[T],
        order_key: str,
    ):
        super().__init__(collection_ref, model)
        assert collection_ref.parent != None
        self.document = FirestoreDocument(collection_ref.parent, document_model)
        self.order_key = order_key

    def _get_order(self) -> list[str]:
        data = self.document.get_with_default()
        return getattr(data, self.order_key, [])

    def _set_order(self, order: list[str]):
        data = self.document.get_with_default()
        setattr(data, self.order_key, order)
        self.document.set(data)

    @override
    def keys(self) -> list[str]:
        """Returns keys in the collection in stored order.

        Unlike the base implementation, this does not require reading all documents.
        """
        return self._get_order()

    def add(self, doc_id: str, data: T):
        """Create document and append it to the order list."""
        existing_order = self._get_order()
        if doc_id in existing_order:
            raise ValueError(f"Document '{doc_id}' already in order list")

        self.set(doc_id, data)
        existing_order.append(doc_id)
        self._set_order(existing_order)

    def remove(self, doc_id: str):
        """Delete document and remove it from the order list."""
        existing_order = self._get_order()
        if doc_id not in existing_order:
            raise ValueError(f"Document '{doc_id}' not in order list")

        self.delete(doc_id)
        new_order = [x for x in existing_order if x != doc_id]
        self._set_order(new_order)

    def set_order(self, new_order: list[str]):
        """Replace the order list with a new explicit order (validated against existing docs)."""
        if sorted(new_order) != sorted(self.keys()):
            raise ValueError("New order has different entries than existing order")

        self._set_order(new_order)


class FirestoreDocument(Generic[T]):
    def __init__(self, ref: DocumentReference, model: Type[T]):
        self.ref = ref
        self.model = model

    @property
    def id(self) -> str:
        return self.ref.id

    def get(self) -> T | None:
        snapshot = self.ref.get()
        if not snapshot.exists:
            return None
        try:
            return self.model.model_validate(snapshot.to_dict())
        except ValidationError:
            return None

    def get_valid(self) -> T:
        snapshot = self.ref.get()
        try:
            return self.model.model_validate(snapshot.to_dict())
        except ValidationError as e:
            raise ServerException(
                "Unexpectedly failed to get document {self.id}: " + str(e)
            )

    def get_with_default(self) -> T:
        """Retrieves the document, constructing it if it doesn't exist."""
        snapshot = self.ref.get()
        return self.model.model_validate(snapshot.to_dict() or {})

    def set(self, data: T):
        self.ref.set(data.model_dump())

    def merge(self, partial: dict):
        self.ref.set(partial, merge=True)

    def delete(self):
        self.ref.delete()


class LibraryRef(FirestoreDocument):
    def __init__(self, ref: DocumentReference):
        super().__init__(ref, LibraryData)
        self.ref = ref

    @property
    def documents(self) -> DocumentsRef:
        return DocumentsRef(self.ref.collection(Collection.DOCUMENTS))

    @property
    def user_data(self) -> AllLibraryUserDataRef:
        return AllLibraryUserDataRef(self.ref.collection(Collection.USER_DATA))


class DocumentsRef(OrderedCollection[LibraryData, Document]):
    def __init__(self, ref: CollectionReference):
        super().__init__(
            ref,
            model=Document,
            document_model=LibraryData,
            order_key="documentOrder",
        )

    def document_ref(self, document_id: str) -> DocumentRef:
        return DocumentRef(self.ref.document(document_id))

    def list(self) -> list[DocumentRef]:
        return [DocumentRef(doc_ref.ref) for doc_ref in self.ref.stream()]


class DocumentRef(FirestoreDocument[Document]):
    def __init__(self, ref: DocumentReference):
        super().__init__(ref, Document)

    @property
    def elements(self) -> ElementsRef:
        return ElementsRef(self.ref.collection(Collection.ELEMENTS))


class ElementsRef(OrderedCollection[Document, Element]):
    def __init__(self, ref: CollectionReference):
        super().__init__(
            ref, model=Element, document_model=Document, order_key="elementOrder"
        )

    def element_ref(self, element_id: str) -> ElementRef:
        return ElementRef(self.ref.document(element_id))

    def list(self) -> list[ElementRef]:
        return [ElementRef(doc_ref.ref) for doc_ref in self.ref.stream()]


class ElementRef(FirestoreDocument[Element]):
    def __init__(self, ref: DocumentReference):
        super().__init__(ref, Element)


class AllLibraryUserDataRef(FirestoreCollection[LibraryUserData]):
    def __init__(self, ref: CollectionReference):
        super().__init__(ref, LibraryUserData)

    def user_data(self, user_id: str) -> LibraryUserDataRef:
        return LibraryUserDataRef(self.ref.document(user_id))

    def list(self) -> list[LibraryUserDataRef]:
        return [LibraryUserDataRef(doc_ref.ref) for doc_ref in self.ref.stream()]


class LibraryUserDataRef(FirestoreDocument[LibraryUserData]):
    def __init__(self, ref: DocumentReference):
        super().__init__(ref, LibraryUserData)

    @property
    def favorites(self) -> FavoritesRef:
        return FavoritesRef(self.ref.collection(Collection.FAVORITES))


class FavoritesRef(FirestoreCollection[Favorite]):
    def __init__(self, ref: CollectionReference):
        super().__init__(ref, Favorite)


class Database:
    def __init__(self, client: firestore.Client):
        self.client = client

    def get_collection(self, collection: Collection) -> CollectionReference:
        return self.client.collection(collection.value)

    @property
    def libraries(self) -> CollectionReference:
        return self.get_collection(Collection.LIBRARIES)

    def library_ref(self, library: Library) -> LibraryRef:
        return LibraryRef(self.libraries.document(library))

    @property
    def user_data(self) -> CollectionReference:
        return self.get_collection(Collection.USER_DATA)

    def get_user_data(self, user_id: str) -> DocumentReference:
        return self.user_data.document(user_id)

    @property
    def sessions(self) -> CollectionReference:
        return self.get_collection(Collection.SESSIONS)


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
