"""User settings saved in Onshape directly."""

from __future__ import annotations

import flask

from backend.common import connect
from backend.common.backend_exceptions import ClientException
from backend.common.connect import (
    get_body_arg,
    get_db,
    get_optional_body_arg,
    get_query_param,
    get_route_user_path,
    user_path_route,
)
from backend.common.database import Database
from backend.common.models import Favorite, UserData

router = flask.Blueprint("user-data", __name__)


@router.get("/user-data" + user_path_route())
def get_user_data(**kwargs):
    db = get_db()
    user_path = get_route_user_path()

    user_data_dict = db.get_user_data(user_path).model_dump(exclude_none=True)
    for favorite_id, favorite in user_data_dict["favorites"].items():
        favorite["id"] = favorite_id

    return user_data_dict


@router.post("/favorites" + user_path_route())
def add_favorite(**kwargs):
    db = get_db()
    user_path = get_route_user_path()
    element_id = get_query_param("elementId")
    default_configuration = get_optional_body_arg("defaultConfiguration")

    # Add it to favorite-order
    user_data = db.get_user_data(user_path)

    if (
        element_id in user_data.favoriteOrder
        or element_id in user_data.favorites.keys()
    ):
        raise ClientException("Element is already a favorite")

    user_data.favoriteOrder.append(element_id)

    favorite = Favorite(defaultConfiguration=default_configuration)
    user_data.favorites[element_id] = favorite

    db.set_user_data(user_path, user_data)

    return {"success": True}


@router.delete("/favorites" + user_path_route())
def remove_favorite(**kwargs):
    db = get_db()
    user_path = get_route_user_path()
    element_id = get_query_param("elementId")

    user_data = db.get_user_data(user_path)

    if (
        element_id not in user_data.favoriteOrder
        or element_id not in user_data.favorites.keys()
    ):
        raise ClientException("Element is not a favorite")

    user_data.favorites.pop(element_id)
    user_data.favoriteOrder = list(
        id for id in user_data.favoriteOrder if id != element_id
    )
    db.set_user_data(user_path, user_data)
    return {"success": True}


@router.post("/favorite-order" + user_path_route())
def set_favorite_order(**kwargs):
    """Sets the order of the current user's favorites."""
    db = get_db()
    user_path = get_route_user_path()
    favorite_order = get_body_arg("favoriteOrder")

    user_data = db.get_user_data(user_path)
    user_data.favoriteOrder = favorite_order
    db.set_user_data(user_path, user_data)
    return {"success": True}


@router.post("/default-configuration" + user_path_route())
def update_default_configuration(**kwargs):
    db = get_db()

    user_path = get_route_user_path()
    favorite_id = connect.get_body_arg("favoriteId")
    default_configuration = connect.get_body_arg("defaultConfiguration")
    user_data = db.get_user_data(user_path)
    user_data.favorites[favorite_id].defaultConfiguration = default_configuration
    db.set_user_data(user_path, user_data)

    return {"success": True}


@router.post("/settings" + user_path_route())
def update_settings(**kwargs):
    db = get_db()

    user_path = get_route_user_path()
    theme = connect.get_body_arg("theme")
    user_data = db.get_user_data(user_path)
    user_data.settings.theme = theme
    db.set_user_data(user_path, user_data)

    return {"success": True}


def delete_favorites(db: Database, element_ids: list[str]):
    """Deletes any element in element_ids from every user's favorites."""
    for user_data_ref in db.user_data.stream():
        user_data = UserData.model_validate(user_data_ref.to_dict())
        user_id = user_data_ref.id

        modified = False
        for element_id in element_ids:
            if user_data.favorites.get(element_id) == None:
                continue

            modified = True
            user_data.favorites.pop(element_id)
            user_data.favoriteOrder = [
                id for id in user_data.favoriteOrder if id != element_id
            ]

        if modified:
            db.user_data.document(user_id).set(user_data.model_dump())
