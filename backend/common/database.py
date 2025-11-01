from __future__ import annotations
from enum import StrEnum
from typing import Generic, Protocol, Type, TypeVar, override, runtime_checkable

from google.cloud import firestore
from google.cloud.firestore import CollectionReference, DocumentReference
from pydantic import BaseModel, ValidationError

from backend.common.backend_exceptions import ServerException
from backend.common.models import (
    Configuration,
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
    CONFIGURATIONS = "configurations"
    LIBRARY_USER_DATA = "libraryUserData"
    FAVORITES = "favorites"
    USER_DATA = "userData"
    SESSIONS = "sessions"


T = TypeVar("T", bound=BaseModel)
S = TypeVar("S", bound=BaseModel)


@runtime_checkable
class BaseDocument(Protocol, Generic[T]):
    id: str

    def get(self) -> T: ...
    def maybe_get(self) -> T | None: ...
    def get_with_default(self) -> T: ...

    def set(self, data: T) -> None: ...
    def update(self, partial: dict) -> None: ...
    def delete(self) -> None: ...
    def collection(
        self, collection: Collection, model: Type[S]
    ) -> BaseCollection[S]: ...


@runtime_checkable
class BaseCollection(Protocol, Generic[T]):
    def list(self) -> list[BaseDocument[T]]: ...
    def keys(self) -> list[str]: ...
    def set(self, doc_id: str, data: T) -> None: ...
    def delete(self, doc_id: str) -> None: ...
    def document(self, doc_id: str) -> BaseDocument[T]: ...


class BaseDocumentRef(BaseDocument[T], Generic[T]):
    def __init__(self, ref: BaseDocument[T]):
        self.ref = ref
        self.id = ref.id

    def get(self) -> T:
        return self.ref.get()

    def maybe_get(self) -> T | None:
        return self.ref.maybe_get()

    def get_with_default(self) -> T:
        return self.ref.get_with_default()

    def set(self, data: T) -> None:
        self.ref.set(data)

    def update(self, partial: dict) -> None:
        self.ref.update(partial)

    def delete(self) -> None:
        self.ref.delete()

    def collection(self, collection: Collection, model: Type[S]) -> BaseCollection[S]:
        return self.ref.collection(collection, model)


class BaseCollectionRef(BaseCollection[T], Generic[T]):
    def __init__(self, ref: BaseCollection[T]):
        self.ref = ref

    def list(self) -> list[BaseDocument[T]]:
        return self.ref.list()

    def keys(self) -> list[str]:
        return self.ref.keys()

    def set(self, doc_id: str, data: T) -> None:
        return self.ref.set(doc_id, data)

    def delete(self, doc_id: str) -> None:
        return self.ref.delete(doc_id)

    def document(self, doc_id: str) -> BaseDocument[Document]:
        return self.document(doc_id)


class FirestoreDocument(BaseDocument[T]):
    def __init__(self, ref: DocumentReference, model: Type[T]):
        self.ref = ref
        self.model = model

    @property
    def id(self) -> str:
        return self.ref.id

    def maybe_get(self) -> T | None:
        snapshot = self.ref.get()
        if not snapshot.exists:
            return None
        try:
            return self.model.model_validate(snapshot.to_dict())
        except ValidationError:
            return None

    def get(self) -> T:
        result = self.maybe_get()
        if result == None:
            raise ServerException("Unexpectedly failed to get document {self.id}")
        return result

    def get_with_default(self) -> T:
        """Retrieves the document, constructing it if it doesn't exist."""
        snapshot = self.ref.get()
        return self.model.model_validate(snapshot.to_dict() or {})

    def set(self, data: T) -> None:
        self.ref.set(data.model_dump())

    def update(self, partial: dict) -> None:
        self.ref.set(partial, merge=True)

    def delete(self) -> None:
        self.ref.delete()

    def collection(
        self, collection: Collection, model: Type[S]
    ) -> FirestoreCollection[S]:
        return FirestoreCollection(self.ref.collection(collection), model)


class FirestoreCollection(BaseCollection[T]):
    """A collection of Firestore documents."""

    def __init__(
        self,
        ref: CollectionReference,
        model: Type[T],
    ):
        self.ref = ref
        self.model = model

    def keys(self) -> list[str]:
        return [doc_ref.id for doc_ref in self.list()]

    def list(self) -> list[FirestoreDocument[T]]:
        return [FirestoreDocument(doc_ref, self.model) for doc_ref in self.ref.stream()]

    def set(self, doc_id: str, data: T) -> None:
        self.ref.document(doc_id).set(data.model_dump())

    def delete(self, doc_id: str) -> None:
        self.ref.document(doc_id).delete()

    def document(self, doc_id: str) -> FirestoreDocument[T]:
        return FirestoreDocument(self.ref.document(doc_id), self.model)


D = TypeVar("D", bound=BaseModel)


class OrderedCollection(BaseCollectionRef[T], Generic[D, T]):
    """An ordered collection that maintains an explicit order list in its parent document."""

    def __init__(
        self,
        collection: BaseCollection[T],
        parent: BaseDocument[D],
        order_key: str,
    ):
        super().__init__(collection)
        self.parent = parent
        self.order_key = order_key

    def _get_order(self) -> list[str]:
        data = self.parent.get()
        return getattr(data, self.order_key, [])

    def _set_order(self, order: list[str]):
        data = self.parent.get()
        setattr(data, self.order_key, order)
        self.parent.set(data)

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


class LibraryRef(BaseDocumentRef[LibraryData]):
    @property
    def documents(self) -> DocumentsRef:
        return DocumentsRef(
            collection=self.ref.collection(Collection.DOCUMENTS, Document),
            parent=self.ref,
            order_key="documentOrder",
        )

    @property
    def user_data(self) -> AllLibraryUserDataRef:
        return AllLibraryUserDataRef(
            self.ref.collection(Collection.LIBRARY_USER_DATA, LibraryUserData)
        )


class DocumentsRef(OrderedCollection[LibraryData, Document]):
    def document(self, document_id: str) -> DocumentRef:
        return DocumentRef(self.ref.document(document_id))

    @override
    def list(self) -> list[DocumentRef]:
        return [DocumentRef(doc_ref) for doc_ref in self.list()]


class DocumentRef(BaseDocumentRef[Document]):
    @property
    def elements(self) -> ElementsRef:
        return ElementsRef(
            collection=self.ref.collection(Collection.ELEMENTS, Element),
            parent=self.ref,
            order_key="elementOrder",
        )

    @property
    def configurations(self) -> ConfigurationsRef:
        return ConfigurationsRef(
            self.ref.collection(Collection.CONFIGURATIONS, Configuration)
        )


class ElementsRef(OrderedCollection[Document, Element]):
    def element(self, element_id: str) -> BaseDocument[Element]:
        return self.ref.document(element_id)


class ConfigurationsRef(BaseCollectionRef[Configuration]):
    def configuration(self, configuration: str) -> BaseDocument[Configuration]:
        return self.ref.document(configuration)


class AllLibraryUserDataRef(BaseCollectionRef[LibraryUserData]):
    def user_data(self, user_id: str) -> LibraryUserDataRef:
        return LibraryUserDataRef(self.ref.document(user_id))

    @override
    def list(self) -> list[LibraryUserDataRef]:
        return [LibraryUserDataRef(doc_ref) for doc_ref in self.ref.list()]


class LibraryUserDataRef(BaseDocumentRef[LibraryUserData]):
    @property
    def favorites(self) -> FavoritesRef:
        return FavoritesRef(self.ref.collection(Collection.FAVORITES, Favorite))


class FavoritesRef(BaseCollectionRef[Favorite]):
    pass


class Database:
    def __init__(self, client: firestore.Client):
        self.client = client

    def get_collection(self, collection: Collection) -> CollectionReference:
        return self.client.collection(collection.value)

    @property
    def libraries(self) -> CollectionReference:
        return self.get_collection(Collection.LIBRARIES)

    def get_library(self, library: Library) -> LibraryRef:
        return LibraryRef(
            FirestoreDocument(self.libraries.document(library), LibraryData)
        )

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
