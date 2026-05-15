"""Contains Path classes for Onshape. Objects can be used to work on Onshape Documents, Workspaces, and Tabs.

The object model has the following elements:
    Document: Represents an Onshape document.
        Notably, documents are actually just collections of instances (workspaces and versions), so this isn't inherently useful on it's own.
    Instance: Represents an Onshape workspace, version, or microversion.
        Workspaces are editable and are thus the most common. Note Onshape allows creating multiple workspaces in the same document, but most users don't utilize this functionality.
        Versions correspond to explicit versions in the version list.
        Microversions typically correspond to individual edits in the edit history of a document.
    Element: Represents an Onshape tab, such as a Part Studio, Assembly, or Drawing.
    Part: Represents a Part inside a Part Studio.

Notes on Path methods:
    to_api_path: This method is static in order to work with api_path.
        In particular, it is important for api_path to be able to print out a subset of the path, as the full path is not always required.
    copy: Creates a copy of a path. This is a class method in order to gain access to the constructor.
"""

from __future__ import annotations
import pathlib
from typing import cast
from urllib import parse
from onshape_api.paths.base_path import BasePath
from onshape_api.paths.instance_type import InstanceType, get_instance_type_key


class DocumentPath(BasePath):
    """Represents a path to an Onshape document.

    Note this isn't very useful on its own since Onshape documents are actually collections of different workspaces, versions, and microversions (instances).
    """

    def __init__(self, document_id: str) -> None:
        self.document_id = document_id

    @staticmethod
    def to_api_path(path: DocumentPath) -> str:
        """Returns a path to this instance formated for api consumption."""
        return "/d/{}".format(path.document_id)

    @staticmethod
    def to_api_object(path: DocumentPath) -> dict:
        """Returns a dict formated for sending to the frontend."""
        return {"documentId": path.document_id}

    @classmethod  # class method in order to have constructor
    def copy(cls, path: DocumentPath) -> DocumentPath:
        return cls(path.document_id)

    def __hash__(self) -> int:
        return hash(self.document_id)

    def __eq__(self, other) -> bool:
        return isinstance(other, DocumentPath) and self.document_id == other.document_id


class InstancePath(DocumentPath):
    """Represents a path to a specific instance (generally a workspace or version) of an Onshape document."""

    def __init__(
        self,
        document_id: str,
        instance_id: str,
        instance_type: str | None = InstanceType.WORKSPACE,
    ) -> None:
        super().__init__(document_id)
        self.instance_id = instance_id
        if instance_type not in InstanceType:
            raise ValueError(
                "Invalid value for instance_type: {}".format(instance_type)
            )
        self.instance_type = cast(InstanceType, instance_type)

    @property
    def wvm(self) -> str:
        """An alias for the string value of instanceType."""
        return str(self.instance_type)

    @staticmethod
    def to_api_path(instance: InstancePath) -> str:
        """Returns a path to this instance formated for api consumption."""
        return DocumentPath.to_api_path(instance) + "/{}/{}".format(
            instance.wvm, instance.instance_id
        )

    @staticmethod
    def to_api_object(path: InstancePath) -> dict:
        """Returns a dict formated for sending to the frontend."""
        object = DocumentPath.to_api_object(path)
        object[get_instance_type_key(path.instance_type)] = path.instance_id
        return object

    @classmethod
    def from_path(
        cls,
        document_path: DocumentPath,
        instance_id: str,
        instance_type: str | None = InstanceType.WORKSPACE,
    ) -> InstancePath:
        return cls(
            document_path.document_id,
            instance_id,
            instance_type,
        )

    @classmethod
    def copy(cls, instance: InstancePath) -> InstancePath:
        return cls(instance.document_id, instance.instance_id, instance.instance_type)

    def __hash__(self) -> int:
        return hash((super().__hash__(), self.instance_id, self.wvm))

    def __eq__(self, other) -> bool:
        return (
            isinstance(other, InstancePath)
            and super().__eq__(other)
            and self.instance_id == other.instance_id
            and self.wvm == other.wvm
        )


class ElementPath(InstancePath):
    """Represents a document tab in an instance."""

    def __init__(
        self,
        document_id: str,
        instance_id: str,
        element_id: str,
        instance_type: str | None = InstanceType.WORKSPACE,
    ) -> None:
        super().__init__(document_id, instance_id, instance_type)
        self.element_id = element_id

    @staticmethod
    def to_api_path(element: ElementPath) -> str:
        """Returns a path to this instance formated for api consumption."""
        return InstancePath.to_api_path(element) + "/e/" + element.element_id

    @staticmethod
    def to_api_object(path: ElementPath) -> dict:
        """Returns a dict formated for sending to the frontend."""
        object = InstancePath.to_api_object(path)
        object["elementId"] = path.element_id
        return object

    @classmethod
    def from_path(cls, instance: InstancePath, element_id: str) -> ElementPath:
        return cls(
            instance.document_id,
            instance.instance_id,
            element_id,
            instance_type=instance.instance_type,
        )

    @classmethod
    def copy(cls, element: ElementPath) -> ElementPath:
        return cls(
            element.document_id,
            element.instance_id,
            element.element_id,
            instance_type=element.instance_type,
        )

    def __hash__(self) -> int:
        return hash((super().__hash__(), self.element_id))

    def __eq__(self, other) -> bool:
        return (
            isinstance(other, ElementPath)
            and self.__eq__(other)
            and self.element_id == other.element_id
        )


class PartPath(ElementPath):
    """Represents a part in a part studio."""

    def __init__(
        self,
        document_id: str,
        instance_id: str,
        element_id: str,
        part_id: str,
        instance_type: str | None = InstanceType.WORKSPACE,
    ) -> None:
        super().__init__(document_id, instance_id, element_id, instance_type)
        self.part_id = part_id

    @staticmethod
    def to_api_object(path: PartPath) -> dict:
        """Returns a dict formated for sending to the frontend."""
        object = ElementPath.to_api_object(path)
        object["partId"] = path.part_id
        return object

    @classmethod
    def copy(cls, part: PartPath) -> PartPath:
        return cls(
            part.document_id,
            part.instance_id,
            part.element_id,
            part.part_id,
            part.instance_type,
        )

    @classmethod
    def from_path(cls, element: ElementPath, part_id: str) -> PartPath:
        return cls(
            element.document_id,
            element.instance_id,
            element.element_id,
            part_id,
            element.instance_type,
        )

    def __hash__(self) -> int:
        return hash((super().__hash__(), self.part_id))

    def __eq__(self, other) -> bool:
        return (
            isinstance(other, PartPath)
            and self.__eq__(other)
            and self.part_id == other.part_id
        )


def url_to_document_path(url: str) -> DocumentPath:
    """Constructs an DocumentPath from an Onshape document url."""
    path = parse.urlparse(url).path
    path = path.removeprefix("/documents")
    parts = pathlib.Path(path).parts
    return DocumentPath(parts[1])


def url_to_instance_path(url: str) -> InstancePath:
    """Constructs an InstancePath from an Onshape document url."""
    path = parse.urlparse(url).path
    path = path.removeprefix("/documents")
    parts = pathlib.Path(path).parts
    return InstancePath(parts[1], parts[3], instance_type=parts[2])


def url_to_element_path(url: str) -> ElementPath:
    """Constructs an ElementPath from an Onshape document url."""
    path = parse.urlparse(url).path
    path = path.removeprefix("/documents")
    parts = pathlib.Path(path).parts
    # /d/<document id>/<instance type>/<instance id>/e/<element type>
    return ElementPath(parts[1], parts[3], parts[5], instance_type=parts[2])


def path_to_url(object: DocumentPath) -> str:
    """Constructs an Onshape document url from a path."""
    base = "https://cad.onshape.com/documents/"
    if isinstance(object, ElementPath):
        api_path = ElementPath.to_api_path(object)
    elif isinstance(object, InstancePath):
        api_path = InstancePath.to_api_path(object)
    else:
        api_path = DocumentPath.to_api_path(object)
    return base + api_path.removeprefix("/d/")


def path_to_frontend_dict(path: ElementPath) -> dict:
    """Converts a path to a dict which can be sent to the frontend.

    This is not implemented as a class method since it's fine to always return every property that's present.
    """
    # Probably should just be a class method, but whatever
    result = {"documentId": path.document_id}
    if isinstance(object, DocumentPath):
        return result

    result.update({"instanceId": path.instance_id, "instanceType": path.instance_type})
    if isinstance(object, InstancePath):
        return result

    result.update({"elementId": path.element_id})
    return result


def path_to_namespace(path: ElementPath, microversion_id: str) -> str:
    return f"d{path.document_id}::{path.instance_type}{path.instance_id}::e{path.element_id}::m{microversion_id}"
