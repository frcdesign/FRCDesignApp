import functools
from flask import request, make_response
import flask


MAX_AGE = 7 * 24 * 3600  # 7 days


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
