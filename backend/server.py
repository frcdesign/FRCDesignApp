import os
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
import flask
from backend.common.app_access import get_app_access_level
from backend.common.app_logging import APP_LOGGER
from onshape_api.endpoints import users
from backend.endpoints import api
from backend.common import connect, env
from backend import oauth


def create_app():
    app = flask.Flask(__name__)
    app.config.update(
        SESSION_COOKIE_NAME="frc-design-lib",
        SECRET_KEY=env.SESSION_SECRET,
        SESSION_COOKIE_SECURE=True,
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="None",
    )
    os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

    app.register_blueprint(api.router)
    app.register_blueprint(oauth.router)

    def serve_index():
        if env.IS_PRODUCTION:
            return flask.send_from_directory("dist", "index.html")
        else:
            APP_LOGGER.info("App running in development mode!")
            return flask.render_template("index.html")

    @app.get("/app")
    def serve_app():
        """The base route used by Onshape."""
        db = connect.get_db()
        api = connect.get_api(db)
        authorized = api.oauth.authorized and users.ping(api, catch=True)
        if not authorized:
            # In Google Cloud the request url is always http
            # But when we redirect we need https to avoid getting blocked by the browser
            secure_url = flask.request.url.replace("http://", "https://", 1)
            # Save redirect url to session so we can get back to /app after processing OAuth2 redirect
            flask.session["redirect_url"] = secure_url
            return flask.redirect("/sign-in")

        if "accessLevel" not in flask.request.args:
            # Redirect to add accessLevel to flask request
            url = flask.request.url.replace("http://", "https://", 1)

            access_level = get_app_access_level(api)
            new_url = add_query_params(url, {"accessLevel": access_level})
            return flask.redirect(new_url)

        return serve_index()

    @app.get("/license")
    @app.get("/grant-denied")
    def serve_static_pages():
        return serve_index()

    # Register production handlers to serve images and other files
    if env.IS_PRODUCTION:

        @app.get("/<filename>")
        def serve_public(filename: str):
            return flask.send_from_directory("dist", filename)

        @app.get("/assets/<filename>")
        def serve_assets(filename: str):
            return flask.send_from_directory("dist/assets", filename)

    else:
        # Development hmr handler which just reflects index.html since vite handles it
        @app.get("/app/<path:current_path>")
        def serve_app_hmr(current_path: str):
            return flask.render_template("index.html")

    return app


def add_query_params(url: str, params: dict) -> str:
    """Adds params in params to url."""
    parsed_url = urlparse(url)
    query_params = dict(parse_qsl(parsed_url.query))
    query_params.update(params)
    new_query = urlencode(query_params)
    return urlunparse(parsed_url._replace(query=new_query))
