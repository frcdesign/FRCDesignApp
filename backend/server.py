import os
import flask
import json5
from backend.common.app_access import get_app_access_level
from backend.common.app_logging import APP_LOGGER
from backend.endpoints import api
from backend.common import connect, env
from backend import oauth
from backend.endpoints.document_order import set_document_order
from backend.endpoints.reload_documents import save_document
from onshape_api.endpoints.users import AccessLevel, ping
from onshape_api.endpoints.versions import get_latest_version_path
from onshape_api.paths.doc_path import url_to_document_path


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

        authorized = api.oauth.authorized and ping(api, catch=True)
        if not authorized:
            # Save redirect url to session so we can get back to /app after processing OAuth2 redirect
            flask.session["redirect_url"] = connect.get_current_url()
            return flask.redirect("/sign-in")

        if "maxAccessLevel" not in flask.request.args:
            # Redirect to add accessLevel to flask request
            url = connect.get_current_url()  # Use current url to preserve query params
            access_level = get_app_access_level(api)
            new_url = connect.add_query_params(
                url,
                {
                    "maxAccessLevel": access_level,
                    # Default to user access in production, otherwise use max access for dev
                    "accessLevel": (
                        AccessLevel.USER if env.IS_PRODUCTION else access_level
                    ),
                },
            )
            return flask.redirect(new_url)

        # Load config.json into the database when app is opened for the first time
        if not env.IS_PRODUCTION and db.get_document_order() == []:
            APP_LOGGER.info("Initializing database using config.json")
            with open("config.json") as file:
                document_urls = json5.load(file)["documents"]
                document_paths = [url_to_document_path(url) for url in document_urls]
                db.set_document_order([path.document_id for path in document_paths])
                for path in document_paths:
                    version_path = get_latest_version_path(api, path)
                    save_document(api, db, version_path)

        return serve_index()

    @app.get("/license")
    @app.get("/grant-denied")
    @app.get("/safari-error")
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
        # Development hmr handler which just reflects index.html since Vite handles it
        @app.get("/app/<path:current_path>")
        def serve_app_hmr(current_path: str):
            return flask.render_template("index.html")

    return app
