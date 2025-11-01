from typing import Generic, Iterable, Type, TypeVar

from pydantic import BaseModel

from backend.common.database import Collection

T = TypeVar("T", bound=BaseModel)


class MockDocument(Generic[T]):
    def __init__(self, doc_id: str, model: Type[T], store: dict[str, dict]):
        self.id = doc_id
        self.model = model
        self._store = store  # shared dict

    def get(self) -> T:
        data = self._store.get(self.id)
        if not data:
            raise KeyError(f"Missing doc {self.id}")
        return self.model.model_validate(data)

    def maybe_get(self) -> T | None:
        data = self._store.get(self.id)
        return self.model.model_validate(data) if data else None

    def set(self, data: T):
        self._store[self.id] = data.model_dump()

    def update(self, partial: dict):
        self._store[self.id] = {**self._store.get(self.id, {}), **partial}

    def delete(self):
        self._store.pop(self.id, None)

    def collection(self, collection: Collection):
        return self._store.get(collection)


class MockCollection(Generic[T]):
    def __init__(self, model: Type[T]):
        self.model = model
        self._store: dict[str, dict] = {}

    def list(self) -> list[MockDocument[T]]:
        return [MockDocument(doc_id, self.model, self._store) for doc_id in self._store]

    def keys(self) -> Iterable[str]:
        return list(self._store.keys())

    def set(self, doc_id: str, data: T):
        self._store[doc_id] = data.model_dump()

    def delete(self, doc_id: str):
        self._store.pop(doc_id, None)

    def document(self, doc_id: str) -> MockDocument[T]:
        return MockDocument(doc_id, self.model, self._store)
