from enum import StrEnum
from io import BytesIO

import urllib
from urllib import parse

from flask import config

from onshape_api.api.api_base import Api
from onshape_api.assertions import assert_instance_type, assert_workspace
from onshape_api.endpoints.configurations import encode_configuration
from onshape_api.paths.api_path import api_path
from onshape_api.paths.instance_type import InstanceType
from onshape_api.paths.doc_path import ElementPath, InstancePath


class ThumbnailSize(StrEnum):
    """Represents the possible sizes of a thumbnail."""

    STANDARD = "300x300"
    LARGE = "600x340"
    SMALL = "300x170"
    TINY = "70x40"

    @classmethod
    def __contains__(cls, item):
        try:
            cls(item)
        except ValueError:
            return False
        return True


def get_instance_thumbnail(
    api: Api, instance_path: InstancePath, size: ThumbnailSize = ThumbnailSize.STANDARD
) -> BytesIO:
    """Returns the thumbnail of a given document."""
    assert_instance_type(instance_path, InstanceType.WORKSPACE, InstanceType.VERSION)
    path = api_path("thumbnails", instance_path, InstancePath) + "/s/" + size
    return BytesIO(api.get(path, is_json=False).content)


def get_element_thumbnail(
    api: Api,
    element_path: ElementPath,
    size: ThumbnailSize = ThumbnailSize.STANDARD,
) -> BytesIO:
    """Returns the thumbnail for a given element."""
    assert_instance_type(element_path, InstanceType.WORKSPACE, InstanceType.VERSION)

    path = api_path("thumbnails", element_path, ElementPath)

    # As far as I can tell, the /ac functionality of this endpoint straight up doesn't work for expressions...
    # if configuration != None:
    #     configuration_id = encode_configuration(configuration)
    #     path += "/ac/" + configuration_id

    path += "/s/" + size
    return BytesIO(api.get(path, is_json=False).content)


def get_thumbnail_id(
    api: Api,
    element_path: ElementPath,
    configuration: str | None = None,
) -> str:
    query = {
        "includeParts": True,
        "includeAssemblies": True,
        "elementId": element_path.element_id,
        "configuration": configuration,
    }

    # There appears to be a bug with this endpoint specifically that prevents + signs from working, very weird
    insertables = api.get(
        api_path("documents", element_path, InstancePath, "insertables"),
        query=query,
    )
    return insertables["items"][0]["predictableThumbnailId"]


def get_thumbnail_from_id(
    api: Api,
    thumbnail_id: str,
    size: ThumbnailSize = ThumbnailSize.STANDARD,
) -> BytesIO:
    """Returns the thumbnail for a given element.

    WARNING: This endpoint is very buggy and can fail repeatedly while Onshape generates the thumbnail in the background.
    """
    path = api_path("thumbnails", end_id=thumbnail_id)
    path += "/s/" + size
    return BytesIO(api.get(path, is_json=False).content)
