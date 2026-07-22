"""
This module provides utilities for setting up an OAuth workflow on the backend server using frontend endpoints.

In particular:
The frontend should be hosted using https.
The frontend should have a /sign-in route which redirects to the /sign-in route below.
The frontend should have a /redirect route which calls the /redirect route below.
"""

import flask
from flask import request
from backend.common import connect, env


router = flask.Blueprint("oauth", __name__)


@router.get("/sign-in")
def sign_in():
    """The oauth sign in route."""
    if request.args.get("redirectOnshapeUri"):
        url = request.args.get("redirectOnshapeUri")
        flask.session["redirect_url"] = url

    db = connect.get_db()
    oauth = connect.get_oauth_session(db, connect.OAuthType.SIGN_IN)

    # Onshape scopes the token to an enterprise using company_id. Without it, the new token gets
    # the same scoping as the one we're replacing, so re-auth can never fix a company mismatch.
    kwargs = {}
    company_id = request.args.get("sessionCompanyId")
    if company_id and company_id != connect.NO_COMPANY:
        kwargs["company_id"] = company_id

    # Saving state is unneeded since Onshape saves it for us
    auth_url, _ = oauth.authorization_url(connect.auth_base_url, **kwargs)

    # Send user to Onshape's sign in page
    return flask.redirect(auth_url)


@router.get("/redirect")
def redirect():
    """The Onshape redirect route.

    Parameters the values received from Onshape.
    """
    if request.args.get("error") == "access_denied":
        return flask.redirect("/grant-denied")

    db = connect.get_db()
    oauth = connect.get_oauth_session(db, connect.OAuthType.REDIRECT)

    token = oauth.fetch_token(
        connect.token_url,
        client_secret=env.CLIENT_SECRET,
        code=request.args["code"],
    )
    connect.set_session_token(db, token)

    redirect_url = flask.session.get("redirect_url")
    if redirect_url == None:
        if connect.is_safari():
            return flask.redirect("/safari-error")
        return flask.redirect("/cookie-error")

    return flask.redirect(redirect_url)
