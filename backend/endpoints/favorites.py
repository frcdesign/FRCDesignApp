"""User settings saved in Onshape directly."""

from __future__ import annotations
from enum import IntEnum

import flask
from pydantic import BaseModel, Field, RootModel, field_validator, model_validator

from backend.common.connect import (
    get_api,
    get_body_arg,
    get_db,
    get_onshape_setting,
    get_optional_body_arg,
    get_query_param,
    get_route_user_path,
    user_path_route,
)
from onshape_api.endpoints.settings import (
    Operation,
    Update,
    set_setting,
    update_setting,
)
from onshape_api.paths.user_path import UserPath


router = flask.Blueprint("favorites", __name__)


class FavoriteOrderVersion(IntEnum):
    V1 = 1


class FavoriteOrder(BaseModel):
    # Don't need to validate since initial release included version
    version: FavoriteOrderVersion = FavoriteOrderVersion.V1
    order: list[FavoriteRef] = Field(default_factory=list)


# Use a model so we can more easily add folders in the future
class FavoriteRef(BaseModel):
    favoriteId: str


class FavoriteVersion(IntEnum):
    V1 = 1


class Favorite(BaseModel):
    # Keep version inside each individual favorite since the main favorites object is a plain dict
    version: FavoriteVersion = FavoriteVersion.V1
    defaultConfiguration: dict[str, str] | None = None

    @field_validator("version", mode="before")
    def validate_version(cls, v):
        if v is None:
            # No version is backwards compatible with V1
            return FavoriteVersion.V1
        return v


class Favorites(RootModel[dict[str, Favorite]]):
    root: dict[str, Favorite]

    # @model_validator(mode="before")
    # @classmethod
    # def inject_ids(cls, data):
    #     """
    #     Ensure each Favorite has an `id`, filling in the dict key if missing.
    #     """
    #     if isinstance(data, dict):
    #         for key, value in list(data.items()):
    #             # Only modify if it's a dict (not already a Favorite) and missing id
    #             if isinstance(value, dict) and "id" not in value:
    #                 value["id"] = key
    #     return data


@router.get("/favorites" + user_path_route())
def get_favorites(**kwargs):
    """Returns a list of all of the current user's favorites."""
    db = get_db()
    api = get_api(db)
    user_path = get_route_user_path()

    favorite_order = get_onshape_setting(
        api, user_path, "favorite-order", FavoriteOrder
    )

    favorite_order_ids: list[str] = []
    for ref in favorite_order.order:
        favorite_order_ids.append(ref.favoriteId)

    favorite_ids = set()
    favorites = get_onshape_setting(api, user_path, "favorites", Favorites)

    favorites_result: dict[str, dict] = favorites.model_dump(exclude_none=True)
    for id in favorites.root.keys():
        favorite_ids.add(id)
        # Inject the id of each favorite into the result
        favorites_result[id]["id"] = id

    if set(favorite_order_ids) != favorite_ids:
        # Validate favorite order and build it if necessary
        # Use favorites as the source of truth since it was added later
        favorite_order_ids = list(favorite_ids)

        refs = [FavoriteRef(favoriteId=id) for id in favorite_order_ids]
        favorite_order = FavoriteOrder(order=refs)
        set_setting(api, user_path, "favorite-order", favorite_order.model_dump())

    return {
        "favorites": favorites_result,
        "favoriteOrder": favorite_order_ids,
    }


@router.post("/favorites" + user_path_route())
def add_favorite(**kwargs):
    user_path = get_route_user_path()
    db = get_db()
    api = get_api(db)
    element_id = get_query_param("elementId")
    default_configuration = get_optional_body_arg("defaultConfiguration")

    # Add it to favorite-order
    favorite_order = get_onshape_setting(
        api, user_path, "favorite-order", FavoriteOrder
    )
    favorite_order.order.append(FavoriteRef(favoriteId=element_id))
    set_setting(api, user_path, "favorite-order", favorite_order.model_dump())

    favorite = Favorite(defaultConfiguration=default_configuration)
    save_favorite(api, user_path, element_id, favorite)

    return {"success": True}


def save_favorite(
    api, user_path: UserPath, element_id: str, favorite: Favorite
) -> None:
    update: Update = {
        "key": "favorites",
        "field": element_id,
        "value": favorite.model_dump(),
        "operation": Operation.SET,
    }
    update_setting(api, user_path, update)


@router.delete("/favorites" + user_path_route())
def remove_favorite(**kwargs):
    db = get_db()
    api = get_api(db)

    user_path = get_route_user_path()
    element_id = get_query_param("elementId")

    favorite_order = get_onshape_setting(
        api, user_path, "favorite-order", FavoriteOrder
    )
    favorite_order.order = [
        ref for ref in favorite_order.order if ref.favoriteId != element_id
    ]
    set_setting(api, user_path, "favorite-order", favorite_order.model_dump())

    update: Update = {
        "key": "favorites",
        "field": element_id,
        "operation": Operation.REMOVE,
    }
    update_setting(api, user_path, update)
    return {"success": True}


@router.post("/favorite-order" + user_path_route())
def set_favorite_order(**kwargs):
    """Sets the order of the current user's favorites."""
    db = get_db()
    api = get_api(db)
    user_path = get_route_user_path()
    favorite_order_arr = get_body_arg("favoriteOrder")

    order = [FavoriteRef(favoriteId=id) for id in favorite_order_arr]
    favorite_order = FavoriteOrder(order=order)
    set_setting(api, user_path, "favorite-order", favorite_order.model_dump())
    return {"success": True}
