from __future__ import annotations

from pydantic import BaseModel, field_validator
from backend.common import env


class SavedElement(BaseModel):
    isVisible: bool = False if env.IS_PRODUCTION else True

    @field_validator("isVisible", mode="before")
    def default_is_visible(cls, v):
        return v if v != None else (False if env.IS_PRODUCTION else True)


class SavedDocument(BaseModel):
    sortAlphabetically: bool = True

    @field_validator("sortAlphabetically", mode="before")
    def default_sort_alphabetically(cls, v):
        return v if v != None else True


class PreservedInfo:
    """A class representing a subset of Document data which should be saved on a best-effort basis when documents are reloaded.

    Used to preserve data which is specified by admins rather than being loaded from Onshape directly.
    """

    def __init__(self) -> None:
        self.preserved_elements: dict[str, SavedElement] = {}
        self.preserved_documents: dict[str, SavedDocument] = {}

    def save_element(self, element_id: str, element_dict: dict) -> None:
        self.preserved_elements[element_id] = SavedElement.model_validate(element_dict)

    def get_element(self, element_id: str) -> SavedElement:
        return self.preserved_elements.get(element_id, SavedElement())

    def save_document(self, document_id: str, document_dict: dict) -> None:
        self.preserved_documents[document_id] = SavedDocument.model_validate(
            document_dict
        )

    def get_document(self, document_id: str) -> SavedDocument:
        return self.preserved_documents.get(document_id, SavedDocument())
