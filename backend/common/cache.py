import functools
from flask import request, make_response
import flask


MAX_AGE = 30 * 24 * 3600  # 30 days


def cache_control_header(private: bool = False) -> str:
    """Returns a Cache-Control header."""
    return f"{"private" if private else "public"}, max-age={MAX_AGE}, immutable"


def cacheable_route(router: flask.Blueprint, rule: str, private: bool = False):
    """
    Decorator to add Cache-Control headers to GET endpoints.
    This will create the route plus a /admin/<route> version of the route.
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
                response.headers["Cache-Control"] = cache_control_header(private)
            return response

        router.add_url_rule(rule, func.__name__, wrapped, methods=["GET"])
        # Add /admin route automatically
        admin_rule = "/admin" + rule
        router.add_url_rule(
            admin_rule, "admin_" + func.__name__, wrapped, methods=["GET"]
        )

        return wrapped

    return decorator
