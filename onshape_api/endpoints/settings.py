from enum import StrEnum
from typing import Any, Iterable, NotRequired, TypedDict
from urllib import parse
from onshape_api.api.oauth_api import OAuthApi
from onshape_api.paths.api_path import api_path
from onshape_api.paths.user_path import UserPath


def get_setting(api: OAuthApi, user_path: UserPath, key: str) -> dict | None:
    """Gets a setting with a specific key."""
    result = get_settings(api, user_path, keys=[key])
    if len(result) == 0:
        return None
    return result[0].get("value", None)


def get_settings(
    api: OAuthApi, user_path: UserPath, keys: Iterable[str] | None = None
) -> list:
    """Returns a list of company or user level settings with the given keys.

    Note result is a list of dicts with `key`s and `value`s.
    """

    query = parse.urlencode({"key": keys}, doseq=True)
    return api.get(
        api_path(
            f"applications/clients/{api.client_id}/settings",
            user_path,
            UserPath,
        ),
        query=query,
    )["settings"]


class Operation(StrEnum):
    SET = "ADD"
    """Sets the value of the given field."""
    UPDATE = "UPDATE"
    """Updates the given field. Throws if it doesn't exist."""
    REMOVE = "REMOVE"
    """Deletes the given field."""


class Update(TypedDict):
    key: str
    value: NotRequired[Any]
    field: NotRequired[str]
    operation: NotRequired[Operation]


def update_settings(
    api: OAuthApi, user_path: UserPath, updates: Iterable[Update]
) -> None:
    api.post(
        api_path(
            f"applications/clients/{api.client_id}/settings",
            user_path,
            UserPath,
        ),
        body={"settings": updates},
        is_json=False,
    )


def update_setting(api: OAuthApi, user_path: UserPath, update: Update) -> None:
    """Applies a single update."""
    update_settings(api, user_path, [update])


def set_setting(api: OAuthApi, user_path: UserPath, key: str, value: Any) -> None:
    """Sets the value of a given key."""
    update: Update = {"key": key, "value": value}
    update_setting(api, user_path, update)
