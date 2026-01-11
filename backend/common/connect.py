"""Serves as an abstraction layer for connecting with the Onshape API and the current flask request."""

from datetime import datetime, timedelta, timezone
import enum
from typing import Any, TypeVar

from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
from uuid import uuid4
import flask
from pydantic import BaseModel
from requests_oauthlib import OAuth2Session
from requests.adapters import HTTPAdapter
from google.cloud import firestore

from backend.common.database import Database, LibraryRef
from backend.common.models import Library
import onshape_api
from backend.common import backend_exceptions, env
from onshape_api.paths.instance_type import InstanceType
from onshape_api.paths.user_path import UserPath


T = TypeVar("T", bound=BaseModel)


def get_deletion_time() -> datetime:
    """Return a UTC timestamp 30 days in the future."""
    return datetime.now(timezone.utc) + timedelta(days=30)


class SessionData(BaseModel):
    token: dict | None = None
    deletionTime: datetime = get_deletion_time()


def get_session_id() -> str:
    session_id = flask.session.get("session_id")
    if session_id is None:
        session_id = str(uuid4())
        flask.session["session_id"] = session_id
    return session_id


def get_session_token(db: Database) -> dict | None:
    session_id = get_session_id()
    doc_ref = db.sessions.document(session_id)
    session_data_dict = doc_ref.get().to_dict()
    session_data = SessionData.model_validate(
        {} if session_data_dict == None else session_data_dict
    )
    return session_data.token


def set_session_token(db: Database, token: dict) -> None:
    session_id = get_session_id()
    doc_ref = db.sessions.document(document_id=session_id)
    doc_ref.set(SessionData(token=token).model_dump())


base_url = "https://oauth.onshape.com/oauth"
auth_base_url = base_url + "/authorize"
token_url = base_url + "/token"


class OAuthType(enum.Enum):
    SIGN_IN = enum.auto()
    REDIRECT = enum.auto()
    USE = enum.auto()


def get_oauth_session(
    db: Database, oauth_type: OAuthType = OAuthType.USE
) -> OAuth2Session:
    if oauth_type == OAuthType.SIGN_IN:
        return OAuth2Session(env.CLIENT_ID)
    elif oauth_type == OAuthType.REDIRECT:
        return OAuth2Session(env.CLIENT_ID, state=flask.request.args["state"])

    refresh_kwargs = {
        "client_id": env.CLIENT_ID,
        "client_secret": env.CLIENT_SECRET,
    }

    def _save_token(token) -> None:
        set_session_token(db, token)

    return OAuth2Session(
        env.CLIENT_ID,
        token=get_session_token(db),
        auto_refresh_url=token_url,
        auto_refresh_kwargs=refresh_kwargs,
        token_updater=_save_token,
    )


def get_current_url() -> str:
    """Returns the url of the current request.

    In Google Cloud, the current url is always http since GCP abstracts the security behind a proxy.
    However, this doesn't work for external users since GCP doesn't allow http connections.
    So, we need to replace http with https in those cases.
    """
    return flask.request.url.replace("http://", "https://", 1)


def library_route():
    """A route with components necessary to receive a library type."""
    return "/library/<library>"


def get_route_library() -> Library:
    return get_route("library")


def user_path_route():
    """A route with components necessary to receive a UserPath."""
    return "/<user_type>/<user_id>"


def get_route_user_path() -> UserPath:
    return UserPath(
        get_route("user_id"),
        get_route("user_type"),
    )


def instance_path_route():
    return "/d/<document_id>/<instance_type>/<instance_id>"


def element_path_route():
    return instance_path_route() + "/e/<element_id>"


DATABASE = Database(firestore.Client(project="frc-design-lib"))


def get_db() -> Database:
    return DATABASE


def get_library_ref() -> LibraryRef:
    return DATABASE.get_library(get_route_library())


ADAPTER = HTTPAdapter(pool_connections=100, pool_maxsize=100, pool_block=True)
# SEMAPHORE = threading.BoundedSemaphore(12)


def get_api() -> onshape_api.OAuthApi:
    # make oauth sessions per request so auth works correctly
    oauth = get_oauth_session(DATABASE)

    oauth.mount("https://", ADAPTER)
    oauth.mount("http://", ADAPTER)

    return onshape_api.make_oauth_api(oauth)


def get_route_instance_path() -> onshape_api.InstancePath:
    return onshape_api.InstancePath(
        get_route("document_id"),
        get_route("instance_id"),
        get_route("instance_type"),
    )


def get_route_element_path() -> onshape_api.ElementPath:
    return onshape_api.ElementPath.from_path(
        get_route_instance_path(),
        get_route("element_id"),
    )


def get_body_instance_path() -> onshape_api.InstancePath:
    instance_type = get_optional_body_arg("instanceType", InstanceType.WORKSPACE)
    return onshape_api.InstancePath(
        get_body_arg("documentId"),
        get_body_arg("instanceId"),
        instance_type=instance_type,
    )


def get_body_element_path() -> onshape_api.ElementPath:
    return onshape_api.ElementPath.from_path(
        get_body_instance_path(),
        get_body_arg("elementId"),
    )


def get_route(route_param: str) -> Any:
    """Returns the value of a path parameter.

    Throws if it doesn't exist.
    """
    view_args = flask.request.view_args
    if view_args == None or (param := view_args.get(route_param)) == None:
        raise backend_exceptions.ClientException(
            "Missing required path parameter {}.".format(route_param)
        )
    return param


def get_query_param(key: str) -> Any:
    """Returns a value from the request query.

    Throws if it doesn't exist.
    """
    value = flask.request.args.get(key)
    if value is None:
        raise backend_exceptions.ClientException(
            "Missing required query parameter {}.".format(key)
        )
    return value


def get_query_bool(key: str, default: bool | None = None) -> bool:
    """Returns a boolean from the request query. Throws if a boolean isn't found and default is None."""
    value = flask.request.args.get(key)
    if value == None:
        if default == None:
            raise backend_exceptions.ClientException(
                "Missing required query parameter {}.".format(key)
            )
        return default

    return str_to_bool(value)


def str_to_bool(s: str) -> bool:
    return s.lower() == "true"


def get_optional_query_param(key: str, default: Any | None = None) -> Any:
    """Returns a value from the request query, or default if it doesn't exist."""
    return flask.request.args.get(key, default)


def get_body_arg(key: str) -> Any:
    """Returns a value from the request body.

    Throws if key doesn't exist.
    """
    value = flask.request.get_json().get(key, None)
    if value == None:
        raise backend_exceptions.ClientException(
            "Missing required body parameter {}.".format(key)
        )
    return value


def get_optional_body_arg(key: str, default: Any | None = None) -> Any:
    """Returns a value from the request body, or default if it doesn't exist."""
    return flask.request.get_json().get(key, default)


def add_query_params(url: str, params: dict) -> str:
    """Adds params in params to url.

    Generated by ChatGPT.
    """
    parsed_url = urlparse(url)
    query_params = dict(parse_qsl(parsed_url.query))
    query_params.update(params)
    new_query = urlencode(query_params)
    return urlunparse(parsed_url._replace(query=new_query))


def is_safari():
    """Returns true if the user is on Apple's Safari browser.

    Generated by ChatGPT.
    """
    ua = flask.request.headers.get("User-Agent", "")
    return (
        "Safari/" in ua
        and "AppleWebKit/" in ua
        and "Chrome/" not in ua
        and "CriOS/" not in ua
        and "FxiOS/" not in ua
        and "Edg/" not in ua
        and "OPR/" not in ua
    )
