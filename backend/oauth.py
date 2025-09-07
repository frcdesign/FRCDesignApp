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
from backend.common.backend_exceptions import ServerException


router = flask.Blueprint("oauth", __name__)


@router.get("/sign-in")
def sign_in():
    """The oauth sign in route."""
    if request.args.get("redirectOnshapeUri"):
        url = request.args.get("redirectOnshapeUri")
        flask.session["redirect_url"] = url

    db = connect.get_db()
    oauth = connect.get_oauth_session(db, connect.OAuthType.SIGN_IN)
    # Saving state is unneeded since Onshape saves it for us
    auth_url, _ = oauth.authorization_url(connect.auth_base_url)

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
    connect.save_token(db, token)

    redirect_url = flask.session.get("redirect_url")
    if redirect_url == None:
        if connect.is_safari_webkit():
            return flask.redirect("/safari-error")
        raise ServerException(
            "Failed to find redirect_url, there may be an issue with cookie handling"
        )
    return flask.redirect(redirect_url)
