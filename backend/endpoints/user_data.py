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
from onshape_api.endpoints.users import AccessLevel

router = flask.Blueprint("user-data", __name__)


class UserDataOut(BaseModel):
    maxAccessLevel: AccessLevel
    currentAccessLevel: AccessLevel
    cacheVersion: int
    theme: str
    library: str


@router.get("/user-data" + user_path_route())
def get_user_data(**kwargs):
    """Returns data required to load the app."""
    db = connect.get_db()

    max_access_level = get_app_access_level()
    current_access_level = AccessLevel.USER if env.IS_PRODUCTION else max_access_level

    user_id = connect.get_route_user_path().user_id

    settings = db.get_user_data(user_id).get_with_default().settings

    library_ref = db.get_library(settings.library)

    return UserDataOut(
        maxAccessLevel=max_access_level,
        currentAccessLevel=current_access_level,
        cacheVersion=library_ref.get_with_default().cacheVersion,
        theme=settings.theme,
        library=settings.library,
    ).model_dump_json(exclude_none=True)


@router.post("/settings" + user_path_route())
def update_settings(**kwargs):
    db = get_db()
    user_path = get_route_user_path()
    user_data_ref = db.get_user_data(user_path.user_id)

    theme = connect.get_optional_body_arg("theme")
    library = connect.get_optional_body_arg("library")

    update_dict = {}
    if theme != None:
        update_dict["settings.theme"] = theme
    if library != None:
        update_dict["settings.library"] = library
    user_data_ref.update(update_dict)

    return {"success": True}
