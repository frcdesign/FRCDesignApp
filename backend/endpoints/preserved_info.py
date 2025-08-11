from __future__ import annotations


class PreservedInfo:
    """A class representing a subset of Document data which should be saved on a best-effort basis when documents are reloaded.

    Used to preserve data which is specified by admins rather than being loaded from Onshape directly.
    """

    def __init__(self) -> None:
        self.preserved_elements: dict[str, dict] = {}
        self.preserved_documents: dict[str, dict] = {}

    def save_element(self, element_id: str, element_dict: dict):
        self.preserved_elements[element_id] = {
            "isVisible": element_dict.get("isVisible", False)
        }

    def load_element(self, element_id: str) -> dict:
        return self.preserved_elements.get(element_id, {"isVisible": False})

    def save_document(self, document_id: str, document_dict: dict):
        self.preserved_documents[document_id] = {
            "sortByDefault": document_dict.get("sortByDefault", True)
        }

    def load_document(self, document_id: str) -> dict:
        return self.preserved_elements.get(document_id, {"sortByDefault": True})
