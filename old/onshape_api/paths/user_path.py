from __future__ import annotations
from enum import StrEnum

from onshape_api.paths.base_path import BasePath


class UserType(StrEnum):
    USER = "users"
    COMPANY = "companies"


class UserPath(BasePath):
    """Represents a path to a user or company used as a part of various endpoints."""

    def __init__(self, user_id: str, user_type: UserType = UserType.USER) -> None:
        self.user_id = user_id
        self.user_type = user_type

    @staticmethod
    def to_api_path(path: UserPath) -> str:
        return f"/{path.user_type}/{path.user_id}"

    @classmethod  # class method in order to have constructor
    def copy(cls, path: UserPath) -> UserPath:
        return cls(path.user_id, path.user_type)

    def __hash__(self) -> int:
        return hash((self.user_id, self.user_type))

    def __eq__(self, other) -> bool:
        return (
            isinstance(other, UserPath)
            and self.user_id == other.user_id
            and self.user_type == other.user_type
        )
