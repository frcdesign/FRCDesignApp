import functools
from flask import request, make_response
import flask

MAX_AGE = 3 * 24 * 3600  # 3 days


def cacheable_route(router: flask.Blueprint, rule: str):
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
                    f"public, max-age={MAX_AGE}, immutable"
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
