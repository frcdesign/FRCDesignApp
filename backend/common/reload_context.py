from __future__ import annotations

from pydantic import BaseModel, field_validator

from backend.common.models import (
    LATEST_DOCUMENT_SCHEMA,
    LATEST_ELEMENT_SCHEMA,
    Document,
    DocumentSchema,
    Element,
    ElementSchema,
    FastenInfo,
)
from onshape_api.paths.doc_path import InstancePath

# Note: We cannot assume the input models are well formed, so every field must have a valid default


class SavedElement(BaseModel):
    elementSchema: ElementSchema | None = None
    isVisible: bool = False
    isOpenComposite: bool = False
    fastenInfo: FastenInfo | None = None
    microversionId: str | None = None

    # Note: We need field validators to default fields which can't be None
    @field_validator("isVisible", mode="before")
    def default_is_visible(cls, v):
        return v if v != None else False

    @field_validator("isOpenComposite", mode="before")
    def default_is_composite(cls, v):
        return v if v != None else False


class SavedDocument(BaseModel):
    documentSchema: DocumentSchema | None = None
    sortAlphabetically: bool = True
    instanceId: str | None = None

    @field_validator("sortAlphabetically", mode="before")
    def default_sort_alphabetically(cls, v):
        return v if v != None else True


class ReloadContext:
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
        """Returns True if the given element should be reloaded from Onshape."""
        if self.reload_all:
            return True

        preserved_element = self.get_element(element_id)
        if (
            preserved_element.elementSchema == None
            or preserved_element.elementSchema < LATEST_ELEMENT_SCHEMA
        ):
            return True

        if preserved_element.microversionId == microversion_id:
            return False

        return True

    def should_reload_document(self, latest_version_path: InstancePath) -> bool:
        """Returns True if the a given document should be reloaded from Onshape."""
        if self.reload_all:
            return True

        preserved_document = self.get_document(latest_version_path.document_id)
        if (
            preserved_document.documentSchema == None
            or preserved_document.documentSchema < LATEST_DOCUMENT_SCHEMA
        ):
            return True

        if preserved_document.instanceId == latest_version_path.instance_id:
            return False

        return True

    def save_document(self, document_id: str, document: Document) -> None:
        self._preserved_documents[document_id] = SavedDocument.model_validate(
            document.model_dump()
        )

    def get_document(self, document_id: str) -> SavedDocument:
        return self._preserved_documents.get(document_id, SavedDocument())
