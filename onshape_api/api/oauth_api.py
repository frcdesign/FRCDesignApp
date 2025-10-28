from __future__ import annotations
from typing import Unpack, override
import http
import json
import logging
from urllib import parse

from requests_oauthlib import OAuth2Session
from requests.adapters import HTTPAdapter

from onshape_api import exceptions
from onshape_api.api.onshape_logger import ONSHAPE_LOGGER
from onshape_api.utils import env_utils
from onshape_api.api.api_base import Api, ApiArgs, get_api_base_args


def make_oauth_api(oauth: OAuth2Session, load_dotenv: bool = False) -> OAuthApi:
    if load_dotenv:
        env_utils.load_env()
    kwargs = get_api_base_args()
    return OAuthApi(oauth, **kwargs)


class OAuthApi(Api):
    """Provides access to the Onshape API via OAuth."""

    def __init__(self, oauth: OAuth2Session, **kwargs: Unpack[ApiArgs]):
        super().__init__(**kwargs)

        self.oauth = oauth
        if oauth.client_id == None:
            raise ValueError("The OAuth2Session must have a client_id")
        self.client_id: str = oauth.client_id

        adapter = HTTPAdapter(
            pool_connections=100,
            pool_maxsize=100,
        )
        self.oauth.mount("https://", adapter)

    @override
    def _request(
        self,
        method: http.HTTPMethod,
        path: str,
        query: dict | str = {},
        body: dict | str = {},
        headers: dict[str, str] = {},
        is_json: bool = True,
    ):
        query_str = query if isinstance(query, str) else parse.urlencode(query)
        body_str = body if isinstance(body, str) else json.dumps(body)

        url = self._base_url + path + "?" + query_str

        ONSHAPE_LOGGER.info("Request url: " + url)
        if body != {} and body != "":
            ONSHAPE_LOGGER.info(body)

        req_headers = headers.copy()
        req_headers["Content-Type"] = headers.get("Content-Type", "application/json")

        res = self.oauth.request(
            method,
            url,
            headers=req_headers,
            data=body_str,
        )
        status = http.HTTPStatus(res.status_code)
        if status.is_success:
            if is_json:
                logging.info("request succeeded, details: " + res.text)
            else:
                ONSHAPE_LOGGER.info("request succeeded")
        else:
            ONSHAPE_LOGGER.exception("request failed, details: " + res.text)
            raise exceptions.ApiError(res.text, status)

        return res.json() if is_json else res
