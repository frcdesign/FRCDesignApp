import flask

from backend.common.connect import (
    get_api,
    get_query_param,
    get_route_user_path,
    user_path_route,
)
from backend.common.database import Database
from onshape_api.endpoints.settings import (
    Operation,
    Update,
    get_setting,
    update_setting,
)


router = flask.Blueprint("settings", __name__)


@router.get("/favorites" + user_path_route())
def get_favorites(**kwargs):
    """Returns a list of all of the current user's favorites."""
    db = Database()
    api = get_api(db)
    client_path = get_route_user_path()

    favorites = get_setting(api, client_path, "favorites")
    if favorites == None:
        favorites = []
    else:
        favorites = favorites["value"]
    return {"favorites": favorites}


@router.post("/favorites" + user_path_route())
def add_favorite(**kwargs):
    client_path = get_route_user_path()
    db = Database()
    api = get_api(db)
    element_id = get_query_param("elementId")

    update: Update = {
        "key": "favorites",
        "field": element_id,
        "value": {},
        "operation": Operation.ADD,
    }
    update_setting(api, client_path, update)
    return {"success": True}


@router.delete("/favorites" + user_path_route())
def remove_favorite(**kwargs):
    db = Database()
    api = get_api(db)

    client_path = get_route_user_path()
    element_id = get_query_param("elementId")

    update: Update = {
        "key": "favorites",
        "field": element_id,
        "operation": Operation.REMOVE,
    }
    update_setting(api, client_path, update)
    return {}
