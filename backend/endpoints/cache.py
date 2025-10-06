import functools
from flask import request, make_response
import flask

from backend.common import connect, env
from backend.common.app_access import get_app_access_level, require_access_level
from backend.common.app_logging import APP_LOGGER
from backend.common.database import Database
from onshape_api.endpoints.users import AccessLevel


MAX_AGE = 7 * 24 * 3600  # 7 days


def cacheable_route(router: flask.Blueprint, rule: str, private: bool = False):
    """
    Decorator to add Cache-Control headers to GET endpoints.
    This will create the route plus a /admin/ version of the route.
    The /admin route will have caching disabled so admins making edits see their changes immediately.
    """

    def decorator(func):

        @functools.wraps(func)
        def wrapped(*args, **kwargs):
            response = make_response(func(*args, **kwargs))
            # If /admin in path, skip cache
            if "/admin" in request.path:
                response.headers["Cache-Control"] = "no-cache"
            else:
                response.headers["Cache-Control"] = (
                    f"{"private" if private else "public"}, max-age={MAX_AGE}, immutable"
                )
            return response

        router.add_url_rule(rule, func.__name__, wrapped, methods=["GET"])
        # Add /admin route automatically
        admin_rule = "/admin" + rule
        router.add_url_rule(
            admin_rule, "admin_" + func.__name__, wrapped, methods=["GET"]
        )

        return wrapped

    return decorator


router = flask.Blueprint("cache-control", __name__)


@router.get("/cache-data")
def get_cache_data(**kwargs):
    db = connect.get_db()

    max_access_level = get_app_access_level()
    current_access_level = AccessLevel.USER if env.IS_PRODUCTION else max_access_level

    return {
        "maxAccessLevel": max_access_level,
        "currentAccessLevel": current_access_level,
        "cacheVersion": get_cache_version(db),
    }


@router.post("/cache-data")
@require_access_level()
def push_cache_version():
    """
    Invalidates all CDN caching by pushing a new version of the app.
    """
    db = connect.get_db()

    new_search_db = connect.get_body_arg("searchDb")
    db.search_db.set({"searchDb": new_search_db})

    increment_cache_version(db)
    return {"success": True}


def get_cache_version(db: Database) -> int:
    doc = db.cache.get().to_dict() or {}
    return doc.get("cacheVersion", 1)


def increment_cache_version(db: Database) -> int:
    doc = db.cache.get().to_dict() or {}
    current = doc.get("cacheVersion", 1) + 1
    doc["cacheVersion"] = current
    db.cache.set(doc)
    return current


@cacheable_route(router, "/search-db")
def get_search_db():
    db = connect.get_db()
    search_db = db.search_db.get().to_dict() or {}
    APP_LOGGER.info(search_db)
    return {"searchDb": search_db.get("searchDb", None)}
