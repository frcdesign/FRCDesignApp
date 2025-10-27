from __future__ import annotations

from pydantic import BaseModel, field_validator

from backend.common.models import Document, Element


class SavedElement(BaseModel):
    isVisible: bool = False
    microversionId: str | None = None

    @field_validator("isVisible", mode="before")
    def default_is_visible(cls, v):
        return v if v != None else False


class SavedDocument(BaseModel):
    sortAlphabetically: bool = True

    @field_validator("sortAlphabetically", mode="before")
    def default_sort_alphabetically(cls, v):
        return v if v != None else True


class PreservedInfo:
    """A class representing a subset of Document data which should be saved on a best-effort basis when documents are reloaded.

    Used to preserve data which is specified by admins rather than being loaded from Onshape directly.
    Also includes data that is needed for caching purposes, e.g., the last saved microversion id.
    """

    def __init__(self, reload_all: bool = False) -> None:
        self._preserved_elements: dict[str, SavedElement] = {}
        self._preserved_documents: dict[str, SavedDocument] = {}
        self.reload_all = reload_all

    def save_element(self, element_id: str, element: Element) -> None:
        self._preserved_elements[element_id] = SavedElement.model_validate(
            element.model_dump()
        )

    def get_element(self, element_id: str) -> SavedElement:
        return self._preserved_elements.get(element_id, SavedElement())

    def should_reload_element(self, element_id: str, microversion_id: str) -> bool:
        """Returns whether the given element should be reloaded from Onshape."""
        if self.reload_all:
            return True

        preserved_element = self.get_element(element_id)
        if preserved_element.microversionId != microversion_id:
            return True

        return False

    def save_document(self, document_id: str, document: Document) -> None:
        self._preserved_documents[document_id] = SavedDocument.model_validate(
            document.model_dump()
        )

    def get_document(self, document_id: str) -> SavedDocument:
        return self._preserved_documents.get(document_id, SavedDocument())
