from __future__ import annotations

import flask
from pydantic import BaseModel

from backend.common import connect, env
from backend.common.app_access import get_app_access_level
from backend.common.connect import (
    get_db,
    get_route_user_path,
    user_path_route,
)
from backend.common.models import Library, Settings, Theme
from onshape_api.endpoints.users import AccessLevel

router = flask.Blueprint("user-data", __name__)


class ContextDataOut(BaseModel):
    maxAccessLevel: AccessLevel
    currentAccessLevel: AccessLevel
    cacheVersion: int


@router.get("/context-data" + user_path_route())
def get_context_data(**kwargs):
    max_access_level = get_app_access_level()
    current_access_level = AccessLevel.USER if env.IS_PRODUCTION else max_access_level

    return ContextDataOut(
        maxAccessLevel=max_access_level,
        currentAccessLevel=current_access_level,
        cacheVersion=get_cache_version(),
    ).model_dump_json(exclude_none=True)


def get_cache_version() -> int:
    db = connect.get_db()
    user_id = connect.get_route_user_path().user_id
    settings = db.get_user_data(user_id).get_with_default().settings
    return db.get_library(settings.library).get_with_default().cacheVersion


@router.get("/user-data" + user_path_route())
def get_user_data(**kwargs):
    """Returns data required to load the app."""
    db = connect.get_db()

    user_id = connect.get_route_user_path().user_id
    user_data = db.get_user_data(user_id).get_with_default()

    return user_data.model_dump_json(exclude_none=True)


@router.post("/settings" + user_path_route())
def update_settings(**kwargs):
    db = get_db()
    user_path = get_route_user_path()
    user_data_ref = db.get_user_data(user_path.user_id)

    theme = connect.get_body_arg("theme")
    library = connect.get_body_arg("library")

    settings = Settings(theme=Theme(theme), library=Library(library))

    update_dict = {"settings": settings.model_dump()}
    user_data_ref.update(update_dict)

    return {"success": True}
