"""User settings saved in Onshape directly."""

from __future__ import annotations

import flask

from backend.common import connect
from backend.common.connect import (
    get_body_arg,
    get_db,
    get_library_ref,
    get_optional_body_arg,
    get_query_param,
    get_route_user_path,
    library_route,
    user_path_route,
)
from backend.common.database import LibraryRef
from backend.common.models import Favorite, Settings

router = flask.Blueprint("user-data", __name__)


# @router.get("/user-data" + library_route() + user_path_route())
# def get_user_data(**kwargs):
#     user_path = get_route_user_path()
#     library = get_library_ref()

#     library.user_ref(user_path.user_id)
#     user_data_dict = library.get_user_data(user_path).model_dump(exclude_none=True)
#     for favorite_id, favorite in user_data_dict["favorites"].items():
#         favorite["id"] = favorite_id

#     return user_data_dict


@router.post("/favorites" + library_route() + user_path_route())
def add_favorite(**kwargs):
    library_ref = get_library_ref()
    user_path = get_route_user_path()
    element_id = get_query_param("elementId")
    default_configuration = get_optional_body_arg("defaultConfiguration")

    # Add it to favorite-order
    user_ref = library_ref.user_data_ref(user_path.user_id)
    user_ref.favorites().add(
        element_id, Favorite(defaultConfiguration=default_configuration)
    )

    return {"success": True}


@router.delete("/favorites" + library_route() + user_path_route())
def remove_favorite(**kwargs):
    library_ref = get_library_ref()
    user_path = get_route_user_path()
    element_id = get_query_param("elementId")

    user_ref = library_ref.user_data_ref(user_path.user_id)
    user_ref.favorites().remove(element_id)

    return {"success": True}


@router.post("/favorite-order" + library_route() + user_path_route())
def set_favorite_order(**kwargs):
    """Sets the order of the current user's favorites."""
    library_ref = get_library_ref()
    user_path = get_route_user_path()
    favorite_order = get_body_arg("favoriteOrder")

    user_ref = library_ref.user_data_ref(user_path.user_id)
    user_ref.favorites().set_order(favorite_order)

    return {"success": True}


@router.post("/default-configuration" + library_route() + user_path_route())
def update_default_configuration(**kwargs):
    library_ref = get_library_ref()
    user_path = get_route_user_path()
    favorite_id = connect.get_body_arg("favoriteId")
    default_configuration = connect.get_body_arg("defaultConfiguration")

    favorite_ref = library_ref.user_data_ref(user_path.user_id).favorite(favorite_id)

    favorite = favorite_ref.get_with_default()
    favorite.defaultConfiguration = default_configuration
    favorite_ref.set(favorite)

    return {"success": True}


@router.post("/settings" + user_path_route())
def update_settings(**kwargs):
    db = get_db()

    user_path = get_route_user_path()
    theme = connect.get_body_arg("theme")
    user_data_ref = db.user_data(user_path.user_id)

    user_data = user_data_ref.get_with_default()
    user_data.settings = Settings(theme=theme)
    user_data_ref.set(user_data)

    return {"success": True}


def delete_favorites(library_ref: LibraryRef, element_ids: list[str]):
    """Deletes any element in element_ids from every user's favorites."""
    for user_data_ref in library_ref.user_data_refs():
        for element_id in element_ids:
            if user_data_ref.favorites().get(element_id) == None:
                continue

            # Deletes could be batched, but ignore for now
            user_data_ref.favorites().remove(element_id)
