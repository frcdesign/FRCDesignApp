from enum import StrEnum
from onshape_api.api.api_base import Api
from onshape_api.paths.api_path import api_path


def get_session_info(api: Api) -> dict:
    return api.get(api_path("users", end_route="sessioninfo"))


def get_user_id(api: Api) -> str:
    """Returns the user_id associated with the current session."""
    return get_session_info(api)["id"]


def ping(api: Api, catch: bool = False) -> bool:
    """Pings the Onshape API's users/sessioninfo endpoint.

    Returns true if the ping was successful, and false if it was not.

    Args:
        catch: True to return False in place of any thrown exceptions.
    """
    try:
        api.get(api_path("users", end_route="sessioninfo"))
        return True
    except Exception as e:
        if catch:
            return False
        raise e


class AccessLevel(StrEnum):
    MEMBER = "member"
    ADMIN = "admin"
    USER = "user"


def get_access_level(api: Api, team_id: str) -> AccessLevel:
    """Returns the access level of a user respective to a given team."""
    team_info = api.get(api_path("teams", end_id=team_id))
    if team_info["admin"]:
        return AccessLevel.ADMIN
    elif team_info["member"]:
        return AccessLevel.MEMBER
    return AccessLevel.USER
