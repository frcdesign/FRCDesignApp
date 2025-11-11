from __future__ import annotations
from collections.abc import Iterable
from enum import StrEnum
from typing import Generic, Protocol, Type, TypeVar, cast, override, runtime_checkable

from google.cloud import firestore
from google.cloud.firestore import (
    CollectionReference,
    DocumentReference,
    DocumentSnapshot,
)
from pydantic import BaseModel, ValidationError

from backend.common.backend_exceptions import ServerException
from backend.common.models import (
    ConfigurationParameters,
    Document,
    Element,
    Favorite,
    Library,
    LibraryData,
    LibraryUserData,
    UserData,
)


class Collection(StrEnum):
    LIBRARIES = "libraries"
    DOCUMENTS = "documents"
    ELEMENTS = "elements"
    CONFIGURATIONS = "configurations"
    LIBRARY_USER_DATA = "library-user-data"
    FAVORITES = "favorites"
    USER_DATA = "user-data"
    SESSIONS = "sessions"


T = TypeVar("T", bound=BaseModel)
S = TypeVar("S", bound=BaseModel)


@runtime_checkable
class BaseDocument(Protocol, Generic[T]):
    id: str

    def get(self) -> T: ...
    def maybe_get(self) -> T | None: ...

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
    def add(self, doc_id: str, data: T) -> None: ...
    def remove(self, doc_id: str) -> None: ...
    def child(self, doc_id: str) -> BaseDocument[T]: ...


class BaseDocumentRef(BaseDocument[T], Generic[T]):
    def __init__(self, ref: BaseDocument[T]):
        self.ref = ref
        self.id = ref.id

    def get(self) -> T:
        return self.ref.get()

    def maybe_get(self) -> T | None:
        return self.ref.maybe_get()

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

    def add(self, doc_id: str, data: T) -> None:
        return self.ref.add(doc_id, data)

    def remove(self, doc_id: str) -> None:
        return self.ref.remove(doc_id)

    def child(self, doc_id: str) -> BaseDocument[T]:
        return self.ref.child(doc_id)


class FirestoreDocument(BaseDocument[T]):
    """A Firestore reference to a given document."""

    def __init__(
        self,
        document_ref: DocumentReference,
        model: Type[T],
        snapshot: DocumentSnapshot | None = None,
    ):
        self.document_ref = document_ref
        self.snapshot = snapshot
        self.model = model

    @property
    def id(self) -> str:
        return self.document_ref.id

    def maybe_get(self) -> T | None:
        if self.snapshot != None:
            snapshot = self.snapshot
        else:
            snapshot = self.document_ref.get()
        if not snapshot.exists:
            return None
        try:
            return self.model.model_validate(snapshot.to_dict() or {})
        except ValidationError:
            return None

    def get(self) -> T:
        """Returns the current value of the document, constructing it if it doesn't exist.

        Note this will still fail if the document exists but is invalid.
        """
        result = self.maybe_get()
        if result == None:
            try:
                return self.model.model_validate({})
            except ValidationError as e:
                raise ServerException(
                    f"Failed to construct {self.model.__name__} with default values: {e}"
                )
        return result

    def set(self, data: T) -> None:
        self.document_ref.set(data.model_dump())

    def update(self, partial: dict) -> None:
        """Updates fields in the document with given partial data.

        Note this calls set with merge=True rather than update.
        set supports automatic document creation but not nested field notation.
        """
        self.document_ref.set(partial, merge=True)

    def delete(self) -> None:
        self.document_ref.delete()

    def collection(
        self, collection: Collection, model: Type[S]
    ) -> FirestoreCollection[S]:
        return FirestoreCollection(self.document_ref.collection(collection), model)


class FirestoreCollection(BaseCollection[T]):
    """A collection of Firestore documents."""

    def __init__(
        self,
        collection_ref: CollectionReference,
        model: Type[T],
    ):
        self.collection_ref = collection_ref
        self.model = model

    def keys(self) -> list[str]:
        # Don't need anything except the document IDs
        return [doc_ref.id for doc_ref in self.collection_ref.select([]).stream()]

    def list(self) -> list[FirestoreDocument[T]]:
        return [
            FirestoreDocument(doc_snapshot.reference, self.model, snapshot=doc_snapshot)
            for doc_snapshot in self.collection_ref.stream()
        ]

    def add(self, doc_id: str, data: T) -> None:
        self.collection_ref.document(doc_id).set(data.model_dump())

    def remove(self, doc_id: str) -> None:
        self.collection_ref.document(doc_id).delete()

    def child(self, doc_id: str) -> FirestoreDocument[T]:
        return FirestoreDocument(self.collection_ref.document(doc_id), self.model)


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
        data = self.parent.maybe_get()
        if data == None:
            return []
        return getattr(data, self.order_key, [])

    @override
    def keys(self) -> list[str]:
        """Returns keys in the collection in stored order.

        Unlike the base implementation, this does not require reading all documents.
        """
        return self._get_order()

    def add(self, doc_id: str, data: T):
        """Create a document and append it to the order list."""
        existing_order = self.keys()
        if doc_id in existing_order:
            raise ValueError(f"Document '{doc_id}' already in order list")

        self.child(doc_id).set(data)
        existing_order.append(doc_id)
        self.set_order(existing_order)

    def remove(self, doc_id: str):
        """Delete a given document and remove it from the order list."""
        existing_order = self._get_order()
        if doc_id not in existing_order:
            raise ValueError(f"Document '{doc_id}' not in order list")

        super().remove(doc_id)
        new_order = [x for x in existing_order if x != doc_id]
        self.set_order(new_order)

    def set_order(self, new_order: list[str]):
        """Replace the order list with a new explicit order (validated against existing docs)."""
        self.parent.update({self.order_key: new_order})


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
        return DocumentRef(self.ref.child(document_id))

    @override
    def list(self) -> list[DocumentRef]:
        return [DocumentRef(doc_ref) for doc_ref in super().list()]


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
            self.ref.collection(Collection.CONFIGURATIONS, ConfigurationParameters)
        )


class ElementsRef(OrderedCollection[Document, Element]):
    def element(self, element_id: str) -> BaseDocument[Element]:
        return self.ref.child(element_id)


class ConfigurationsRef(BaseCollectionRef[ConfigurationParameters]):
    def configuration(
        self, configuration: str
    ) -> BaseDocument[ConfigurationParameters]:
        return self.ref.child(configuration)


class AllLibraryUserDataRef(BaseCollectionRef[LibraryUserData]):
    def user_data(self, user_id: str) -> LibraryUserDataRef:
        return LibraryUserDataRef(self.ref.child(user_id))

    @override
    def list(self) -> list[LibraryUserDataRef]:
        return [LibraryUserDataRef(doc_ref) for doc_ref in super().list()]


class LibraryUserDataRef(BaseDocumentRef[LibraryUserData]):
    @property
    def favorites(self) -> FavoritesRef:
        return FavoritesRef(
            collection=self.ref.collection(Collection.FAVORITES, Favorite),
            parent=self.ref,
            order_key="favoriteOrder",
        )


class FavoritesRef(OrderedCollection[LibraryUserData, Favorite]):
    def favorite(self, favorite_id: str) -> BaseDocument[Favorite]:
        return self.ref.child(favorite_id)


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

    def get_user_data(self, user_id: str) -> FirestoreDocument[UserData]:
        return FirestoreDocument(self.user_data.document(user_id), UserData)

    @property
    def sessions(self) -> CollectionReference:
        return self.get_collection(Collection.SESSIONS)


def delete_collection(
    collection_ref: CollectionReference,
    batch_size: int = 500,
):
    """Deletes all documents in a Firestore collection."""
    docs = cast(Iterable[DocumentSnapshot], collection_ref.limit(batch_size).stream())
    deleted = 0

    for doc in docs:
        doc.reference.delete()
        deleted += 1

    if deleted >= batch_size:
        return delete_collection(collection_ref, batch_size)
