import os
import flask
from backend.common.app_logging import APP_LOGGER, log_app_opened
from backend.endpoints import api
from backend.common import connect, env
from backend import oauth
from onshape_api.endpoints.users import get_session_info


def create_app():
    app = flask.Flask(__name__)
    app.config.update(
        SESSION_COOKIE_NAME="frc-design-app",
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
            response = flask.send_from_directory("dist", "index.html", etag=True)
            response.headers["Cache-Control"] = "no-cache, must-revalidate"
            return response
        else:
            APP_LOGGER.info("App running in development mode!")
            return flask.render_template("index.html")

    @app.get("/app")
    async def serve_app():
        """The base route used by Onshape."""
        api = connect.get_api()

        def redirect_to_sign_in():
            # Save redirect url to session so we can get back here after processing OAuth2 redirect
            flask.session["redirect_url"] = connect.get_current_url()
            return flask.redirect("/sign-in")

        if not api.oauth.authorized:
            return redirect_to_sign_in()

        try:
            # Doubles as the auth check: fails if the token is invalid.
            session_info = get_session_info(api)
        except Exception:
            return redirect_to_sign_in()

        # Re-auth if the user's active company differs from the token's company. The
        # token is tied to the company the user was in when they authorized, so a company
        # switch requires a fresh token to talk to the right company. Onshape sends "cad"
        # for non-enterprise sessions, which matches a token that has no company.
        param_company_id = connect.get_optional_query_param("sessionCompanyId")
        company = session_info.get("company") or {}
        token_company_id = company.get("id") or "cad"
        if token_company_id != param_company_id:
            return redirect_to_sign_in()

        try:
            # This should never fail, but not worth crashing over
            user_id = connect.get_query_param("userId")
            log_app_opened(user_id)
        except:
            pass

        return serve_index()

    @app.errorhandler(404)
    def page_not_found(error):
        # Not found errors are handled on the client
        return serve_index()

    @app.get("/not-found")
    @app.get("/grant-denied")
    @app.get("/license")
    @app.get("/safari-error")
    @app.get("/beta-complete")
    def serve_static_pages():
        return serve_index()

    # Register production handlers to serve images and other files
    if env.IS_PRODUCTION:

        @app.get("/<filename>")
        def serve_public(filename: str):
            return flask.send_from_directory("dist", filename)

        @app.get("/assets/<filename>")
        def serve_assets(filename: str):
            response = flask.send_from_directory("dist/assets", filename)
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            return response

    else:
        # Development hmr handler which just reflects index.html since Vite handles it
        @app.get("/app/<path:current_path>")
        def serve_app_hmr(current_path: str):
            return flask.render_template("index.html")

    return app
