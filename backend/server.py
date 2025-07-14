import logging
import os
import flask
from onshape_api.endpoints import settings
from backend.endpoints import api
from backend.common import connect, database, env
from backend import oauth


def create_app():
    app = flask.Flask(__name__)
    app.config.update(
        SESSION_COOKIE_NAME="robot-manager",
        SECRET_KEY=env.session_secret,
        SESSION_COOKIE_SECURE=True,
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="None",
    )
    os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

    app.register_blueprint(api.router)
    app.register_blueprint(oauth.router)

    def serve_index():
        if env.is_production:
            return flask.send_from_directory("dist", "index.html")
        else:
            logging.info("App running in development mode!")
            return flask.render_template("index.html")

    @app.get("/app")
    def serve_app():
        """The base route used by Onshape."""
        db = database.Database()
        api = connect.get_api(db)
        authorized = api.oauth.authorized and settings.ping(api, catch=True)
        if not authorized:
            # In Google Cloud the request url is always http
            # But when we redirect we need https to avoid getting blocked by the browser
            secure_url = flask.request.url.replace("http://", "https://", 1)
            flask.session["redirect_url"] = secure_url
            return flask.redirect("/sign-in")
        return serve_index()

    @app.get("/license")
    @app.get("/grant-denied")
    def serve_static_pages():
        return serve_index()

    if env.is_production:
        # Production only handlers:
        @app.get("/robot-icon.svg")
        def serve_icon():
            return flask.send_from_directory("dist", "robot-icon.svg")

        @app.get("/assets/<path:filename>")
        def serve_assets(filename: str):
            return flask.send_from_directory("dist/assets", filename)

    else:
        # Development hmr handler
        @app.get("/app/<path:current_path>")
        def serve_app_hmr(current_path: str):
            # The specific path doesn't matter, the template handles all
            return flask.render_template("index.html")

    return app
