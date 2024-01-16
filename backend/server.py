import os
import flask
from onshape_api.endpoints import users
from backend import api
from backend.common import connect, env
from backend import oauth


def create_app():
    app = flask.Flask(__name__)
    app.config.update(
        SESSION_COOKIE_NAME="robot-manager", SECRET_KEY=env.session_secret
    )
    os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

    app.register_blueprint(api.router)
    app.register_blueprint(oauth.router)

    def serve_index():
        if env.is_production:
            return flask.send_from_directory("dist", "index.html")
        else:
            return flask.render_template("index.html")

    @app.get("/app")
    def serve_app():
        api = connect.get_api()
        authorized = api.oauth.authorized and users.ping(api, catch=True)
        if not authorized:
            flask.session["redirect_url"] = flask.request.url
            return flask.redirect("/sign-in")
        return serve_index()

    @app.get("/grant-denied")
    def serve_grant_denied():
        return serve_index()

    # Handle production asset paths
    @app.get("/assets/<path:filename>")
    def serve_assets(filename: str):
        return flask.send_from_directory("dist/assets", filename)

    return app
