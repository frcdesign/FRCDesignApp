from functools import wraps
from backend.common import connect
from backend.common import env
from backend.common.backend_exceptions import AuthException
from onshape_api.api.api_base import Api
from onshape_api.endpoints.users import AccessLevel, get_access_level


def get_app_access_level(api: Api) -> AccessLevel:
    if env.IS_PRODUCTION:
        if env.ADMIN_TEAM == None:
            raise ValueError("ADMIN_TEAM must be set in production")
        # In production get the user's access level, no ifs or buts
        return get_access_level(api, env.ADMIN_TEAM)

    if env.ACCESS_LEVEL_OVERRIDE:
        return AccessLevel(env.ACCESS_LEVEL_OVERRIDE)

    if env.ADMIN_TEAM == None:
        raise ValueError(
            "Either ACCESS_LEVEL_OVERRIDE or ADMIN_TEAM must be set in development"
        )
    return get_access_level(api, env.ADMIN_TEAM)


def require_member_access():
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            db = connect.get_db()
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
            db = connect.get_db()
            api = connect.get_api(db)
            access_level = get_app_access_level(api)

            if access_level != AccessLevel.ADMIN:
                raise AuthException(access_level)

            return f(*args, **kwargs)

        return wrapped

    return decorator
