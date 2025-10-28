from functools import wraps
import inspect

import flask
from backend.common import connect
from backend.common import env
from backend.common.backend_exceptions import AuthException
from onshape_api.api.api_base import Api
from onshape_api.endpoints.users import AccessLevel, get_access_level


def compute_app_access_level(api: Api) -> AccessLevel:
    if env.IS_PRODUCTION:
        if env.ADMIN_TEAM == None:
            raise ValueError("ADMIN_TEAM must be set in production")
        # In production get the user's access level, no ifs or buts
        return get_access_level(api, env.ADMIN_TEAM)

    if env.ACCESS_LEVEL_OVERRIDE != None:
        return AccessLevel(env.ACCESS_LEVEL_OVERRIDE)

    if env.ADMIN_TEAM == None:
        raise ValueError(
            "Either ACCESS_LEVEL_OVERRIDE or ADMIN_TEAM must be set in development"
        )
    return get_access_level(api, env.ADMIN_TEAM)


def get_app_access_level() -> AccessLevel:
    access_level = flask.session.get("access_level")

    if access_level == None:
        db = connect.get_db()
        api = connect.get_api(db)
        access_level = compute_app_access_level(api)

        flask.session["access_level"] = access_level

    return access_level


def check_access_level(required_access_level: AccessLevel = AccessLevel.MEMBER):
    access_level = get_app_access_level()

    if required_access_level == AccessLevel.MEMBER:
        if access_level == AccessLevel.MEMBER or access_level == AccessLevel.ADMIN:
            return
    elif required_access_level == AccessLevel.ADMIN:
        if access_level == AccessLevel.ADMIN:
            return

    raise AuthException(access_level)


def require_access_level(required_access_level: AccessLevel = AccessLevel.MEMBER):
    def decorator(func):
        if inspect.iscoroutinefunction(func):
            # async route
            @wraps(func)
            async def wrapped_async(*args, **kwargs):
                check_access_level(required_access_level)
                return await func(*args, **kwargs)

            return wrapped_async
        else:
            # sync route
            @wraps(func)
            def wrapped(*args, **kwargs):
                check_access_level(required_access_level)
                return func(*args, **kwargs)

            return wrapped

    return decorator
