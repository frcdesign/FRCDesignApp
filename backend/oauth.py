"""
This module provides utilities for setting up an OAuth workflow on the backend server using frontend endpoints.

In particular:
The frontend should be hosted using https.
The frontend should have a /sign-in route which redirects to the /sign-in route below.
The frontend should have a /redirect route which calls the /redirect route below.
"""

import logging
import flask
from flask import request
from backend.common import connect, database, env


router = flask.Blueprint("oauth", __name__)


@router.get("/sign-in")
def sign_in():
    """The oauth sign in route."""
    if request.args.get("redirectOnshapeUri"):
        url = request.args.get("redirectOnshapeUri")
        flask.session["redirect_url"] = url

    db = database.Database()
    oauth = connect.get_oauth_session(db, connect.OAuthType.SIGN_IN)
    # Saving state is unneeded since Onshape saves it for us
    auth_url, _ = oauth.authorization_url(connect.auth_base_url)

    # Send user to Onshape's sign in page
    return flask.redirect(auth_url)


@router.get("/redirect")
def redirect():
    """The Onshape redirect route.

    Parameters:
        The code and state parameters received from Onshape.
    """
    if request.args.get("error") == "access_denied":
        return flask.redirect("/grant-denied")

    db = database.Database()
    oauth = connect.get_oauth_session(db, connect.OAuthType.REDIRECT)

    token = oauth.fetch_token(
        connect.token_url,
        client_secret=env.client_secret,
        code=request.args["code"],
    )
    connect.save_token(db, token)

    redirect_url = flask.session["redirect_url"]
    return flask.redirect(redirect_url)
