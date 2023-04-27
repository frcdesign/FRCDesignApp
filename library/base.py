from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Self

from library import utils


class Node(ABC):
    @abstractmethod
    def __str__(self) -> str:
        raise NotImplementedError


class ChildNode(Node, ABC):
    def __init__(self, *args, parent: ParentNode, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        parent.add(self)


class ParentNode(Node, ABC):
    """A node which supports an array of (possibly nested) children."""

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.children: list[Node] = []

    def add(self, *children: Node) -> Self:
        """Adds one or more children to the class."""
        self.children.extend(children)
        return self

    def children_str(self, **kwargs) -> str:
        return utils.to_str(self.children, **kwargs)
