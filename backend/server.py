import os
import flask
import json5
from backend.common.app_logging import APP_LOGGER, log_app_opened
from backend.endpoints import api
from backend.common import connect, env
from backend import oauth
from backend.endpoints.documents import reload_documents
from onshape_api.endpoints.users import ping
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
    async def serve_app():
        """The base route used by Onshape."""
        db = connect.get_db()
        api = connect.get_api(db)

        authorized = api.oauth.authorized and ping(api, catch=True)
        if not authorized:
            # Save redirect url to session so we can get back here after processing OAuth2 redirect
            flask.session["redirect_url"] = connect.get_current_url()

            return flask.redirect("/sign-in")

        user_id = connect.get_query_param("userId")
        log_app_opened(user_id)

        if not env.IS_PRODUCTION and db.get_document_order() == []:
            APP_LOGGER.info("Loading documents from config.json!")
            with open("config.json") as f:
                json = json5.load(f)
                document_order = [
                    url_to_document_path(url).document_id for url in json["documents"]
                ]
                db.set_document_order(document_order)
                await reload_documents()

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
