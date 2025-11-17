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
from backend.common.models import Favorite, Library, Settings, Theme
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
    settings = db.get_user_data(user_id).get().settings
    return db.get_library(settings.library).get().cacheVersion


@router.get("/user-data" + user_path_route())
def get_user_data(**kwargs):
    """Returns data required to load the app."""
    db = connect.get_db()

    user_id = connect.get_route_user_path().user_id
    user_data = db.get_user_data(user_id).get()

    return user_data.model_dump_json(exclude_none=True)


@router.post("/settings" + user_path_route())
def update_settings(**kwargs):
    db = get_db()
    user_path = get_route_user_path()
    user_data_ref = db.get_user_data(user_path.user_id)

    theme = connect.get_optional_body_arg("theme")
    library = connect.get_optional_body_arg("library")

    settings = user_data_ref.get().settings

    if theme != None:
        settings.theme = Theme(theme)
    if library != None:
        settings.library = Library(library)

    update_dict = {"settings": settings.model_dump()}
    user_data_ref.update(update_dict)

    return {"success": True}


class FavoriteOut(BaseModel):
    id: str
    defaultConfiguration: dict[str, str] | None


class LibraryUserDataOut(BaseModel):
    favorites: dict[str, FavoriteOut]
    favoriteOrder: list[str]


@router.get("/library-user-data" + connect.library_route() + connect.user_path_route())
def get_library_user_data(**kwargs):
    user_id = connect.get_route_user_path().user_id
    library_ref = connect.get_library_ref()

    favorites_ref = library_ref.user_data.user_data(user_id).favorites
    favorites: dict[str, FavoriteOut] = {}
    for favorite_ref in favorites_ref.list():
        favorite = favorite_ref.get()
        favorites[favorite_ref.id] = FavoriteOut(
            id=favorite_ref.id, defaultConfiguration=favorite.defaultConfiguration
        )

    return LibraryUserDataOut(
        favorites=favorites, favoriteOrder=favorites_ref.keys()
    ).model_dump_json(exclude_none=True)


@router.post("/favorites" + connect.library_route() + connect.user_path_route())
def add_favorite(**kwargs):
    library_ref = connect.get_library_ref()
    user_path = connect.get_route_user_path()
    element_id = connect.get_query_param("elementId")
    default_configuration = connect.get_optional_body_arg("defaultConfiguration")

    # Add it to favorite-order
    user_ref = library_ref.user_data.user_data(user_path.user_id)
    user_ref.favorites.add(
        element_id, Favorite(defaultConfiguration=default_configuration)
    )

    return {"success": True}


@router.delete("/favorites" + connect.library_route() + connect.user_path_route())
def remove_favorite(**kwargs):
    library_ref = connect.get_library_ref()
    user_path = connect.get_route_user_path()
    element_id = connect.get_query_param("elementId")

    user_ref = library_ref.user_data.user_data(user_path.user_id)
    user_ref.favorites.remove(element_id)

    return {"success": True}


@router.post("/favorite-order" + connect.library_route() + connect.user_path_route())
def set_favorite_order(**kwargs):
    """Sets the order of the current user's favorites."""
    library_ref = connect.get_library_ref()
    user_path = connect.get_route_user_path()
    favorite_order = connect.get_body_arg("favoriteOrder")

    user_ref = library_ref.user_data.user_data(user_path.user_id)
    user_ref.favorites.set_order(favorite_order)

    return {"success": True}


@router.post(
    "/default-configuration" + connect.library_route() + connect.user_path_route()
)
def update_default_configuration(**kwargs):
    library_ref = connect.get_library_ref()
    user_path = connect.get_route_user_path()
    favorite_id = connect.get_body_arg("favoriteId")
    default_configuration = connect.get_body_arg("defaultConfiguration")

    favorite_ref = library_ref.user_data.user_data(
        user_path.user_id
    ).favorites.favorite(favorite_id)

    favorite_ref.update({"defaultConfiguration": default_configuration})

    return {"success": True}
