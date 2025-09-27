"""User settings saved in Onshape directly."""

from __future__ import annotations
from enum import IntEnum
import uuid

import flask
from pydantic import BaseModel, field_validator

from backend.common.connect import (
    get_api,
    get_db,
    get_optional_body_arg,
    get_query_param,
    get_route_user_path,
    user_path_route,
)
from onshape_api.endpoints.settings import (
    Operation,
    Update,
    get_setting,
    update_setting,
)


router = flask.Blueprint("favorites", __name__)


class FavoriteVersion(IntEnum):
    V1 = 1


class Favorite(BaseModel):
    version: FavoriteVersion = FavoriteVersion.V1
    defaultConfiguration: str | None = None

    @field_validator("version", mode="before")
    def validate_version(cls, v):
        if v is None:
            # No version is backwards compatible with V1
            return FavoriteVersion.V1
        return v


@router.get("/favorites" + user_path_route())
def get_favorites(**kwargs):
    """Returns a list of all of the current user's favorites."""
    db = get_db()
    api = get_api(db)
    user_path = get_route_user_path()

    favorites_result = get_setting(api, user_path, "favorites")

    favorites = []
    if favorites_result != None:
        # Convert from dict mapping ids to favorites to array
        # This is a bit goofy since we immediately convert back in the frontend, but it's uniform with /documents and /elements
        for [key, value] in favorites_result.items():
            value["id"] = key
            favorites.append(value)

    return {"favorites": favorites}


@router.post("/favorites" + user_path_route())
def add_favorite(**kwargs):
    user_path = get_route_user_path()
    db = get_db()
    api = get_api(db)
    element_id = get_query_param("elementId")
    default_configuration = get_optional_body_arg("defaultConfiguration", None)

    favorite = Favorite(defaultConfiguration=default_configuration)

    update: Update = {
        "key": "favorites",
        "field": element_id,
        "value": favorite.model_dump(),
        "operation": Operation.SET,
    }

    update_setting(api, user_path, update)
    return {"success": True}


@router.delete("/favorites" + user_path_route())
def remove_favorite(**kwargs):
    db = get_db()
    api = get_api(db)

    user_path = get_route_user_path()
    element_id = get_query_param("elementId")

    update: Update = {
        "key": "favorites",
        "field": element_id,
        "operation": Operation.REMOVE,
    }
    update_setting(api, user_path, update)
    return {"success": True}
