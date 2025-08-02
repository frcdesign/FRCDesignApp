from functools import wraps
import logging
from backend.common import connect
from backend.common import env
from backend.common.backend_exceptions import AuthException
from onshape_api.api.api_base import Api
from onshape_api.endpoints.users import AccessLevel, get_access_level


def get_app_access_level(api: Api) -> AccessLevel:
    if env.is_production:
        # In production get the user's access level, no ifs or buts
        return get_access_level(api, env.admin_team)

    if env.access_level_override:
        return AccessLevel(env.access_level_override)

    return get_access_level(api, env.admin_team)


def require_member_access():
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            db = connect.Database()
            api = connect.get_api(db)
            access_level = get_app_access_level(api)

            if access_level != AccessLevel.MEMBER and access_level != AccessLevel.ADMIN:
                raise AuthException(access_level)

            return f(*args, **kwargs)

        return wrapped

    return decorator


def require_admin_access():
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            db = connect.Database()
            api = connect.get_api(db)
            access_level = get_app_access_level(api)

            if access_level != AccessLevel.ADMIN:
                raise AuthException(access_level)

            return f(*args, **kwargs)

        return wrapped

    return decorator
