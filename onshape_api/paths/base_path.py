from __future__ import annotations

from abc import ABC, abstractmethod


class BasePath(ABC):
    """Represents a path to something in Onshape."""

    @staticmethod
    @abstractmethod
    def to_api_path(path: BasePath) -> str:
        """Returns a path to this instance formated for api consumption."""
        ...

    @classmethod  # class method in order to have constructor
    @abstractmethod
    def copy(cls, path: BasePath) -> BasePath: ...

    @abstractmethod
    def __hash__(self) -> int: ...

    @abstractmethod
    def __eq__(self, other) -> bool: ...

    def __str__(self) -> str:
        return self.to_api_path(self)
