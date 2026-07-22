import os
import flask
from backend.common.app_logging import APP_LOGGER, log_app_opened
from backend.endpoints import api
from backend.common import connect, env
from backend import oauth
from onshape_api.endpoints.users import get_session_info


# Session key recording the company we already sent the user through OAuth for.
REAUTH_COMPANY_KEY = "reauth_company_id"


def get_reauth_company_id(session_info: dict) -> str | None:
    """Returns the company id to re-authorize against, or None if the current token is fine.

    The token is tied to the company the user was in when they authorized, so a company switch
    requires a fresh token to talk to the right company.
    """
    session_company_id = connect.get_optional_query_param("sessionCompanyId")
    if session_company_id == None:
        # Onshape didn't send the param, so there's nothing to compare against.
        return None

    company = session_info.get("company") or {}
    token_company_id = company.get("id") or connect.NO_COMPANY
    if token_company_id == session_company_id:
        flask.session.pop(REAUTH_COMPANY_KEY, None)
        return None

    # Onshape only populates sessionCompanyId for enterprises, so a non-enterprise company on the
    # token isn't a real mismatch - it's just a company the param can never report.
    if session_company_id == connect.NO_COMPANY and not company.get("enterpriseBaseUrl"):
        return None

    if flask.session.get(REAUTH_COMPANY_KEY) == session_company_id:
        # Re-auth already failed to fix this. Serving the app with the old token beats bouncing
        # the user through OAuth forever.
        return None

    flask.session[REAUTH_COMPANY_KEY] = session_company_id
    return session_company_id


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

        def redirect_to_sign_in(company_id: str | None = None):
            # Save redirect url to session so we can get back here after processing OAuth2 redirect
            flask.session["redirect_url"] = connect.get_current_url()
            url = "/sign-in"
            if company_id != None:
                url = connect.add_query_params(url, {"sessionCompanyId": company_id})
            return flask.redirect(url)

        if not api.oauth.authorized:
            return redirect_to_sign_in()

        try:
            # Doubles as the auth check: fails if the token is invalid.
            session_info = get_session_info(api)
        except Exception:
            return redirect_to_sign_in()

        # Re-auth if the user's active company differs from the token's company.
        reauth_company_id = get_reauth_company_id(session_info)
        if reauth_company_id != None:
            return redirect_to_sign_in(reauth_company_id)

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
