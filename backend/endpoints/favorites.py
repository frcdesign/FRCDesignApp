"""User settings saved in Onshape directly."""

from __future__ import annotations

from enum import StrEnum
import flask
from pydantic import BaseModel

from backend.common import connect
from backend.common.connect import (
    get_api,
    get_db,
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


class Theme(StrEnum):
    SYSTEM = "system"
    LIGHT = "light"
    DARK = "dark"


class Settings(BaseModel):
    theme: Theme = Theme.SYSTEM


@router.get("/settings" + user_path_route())
def get_settings(**kwargs):
    db = get_db()
    api = get_api(db)
    user_path = get_route_user_path()

    settings_dict = get_setting(api, user_path, "settings")
    settings = Settings.model_validate(settings_dict if settings_dict != None else {})
    return settings.model_dump()


@router.post("/settings" + user_path_route())
def update_settings(**kwargs):
    db = get_db()
    api = get_api(db)

    user_path = get_route_user_path()
    theme = connect.get_body_arg("theme")
    update: Update = {
        "key": "settings",
        "field": "theme",
        "value": theme,
        "operation": Operation.ADD,
    }
    update_setting(api, user_path, update)

    return {"success": True}


@router.get("/favorites" + user_path_route())
def get_favorites(**kwargs):
    """Returns a list of all of the current user's favorites."""
    db = get_db()
    api = get_api(db)
    user_path = get_route_user_path()

    favorites_result = get_setting(api, user_path, "favorites")

    if favorites_result == None:
        favorites = []
    else:
        # Convert from dict mapping ids to {} to array
        # This is a bit goofy since we immediately convert back in the frontend, but it's uniform with /documents and /elements
        favorites = [{"id": id} for id in favorites_result.keys()]

    return {"favorites": favorites}


@router.post("/favorites" + user_path_route())
def add_favorite(**kwargs):
    user_path = get_route_user_path()
    db = get_db()
    api = get_api(db)
    element_id = get_query_param("elementId")

    update: Update = {
        "key": "favorites",
        "field": element_id,
        "value": {},
        "operation": Operation.ADD,
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
    return {}
