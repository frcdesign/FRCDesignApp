from enum import StrEnum
from io import BytesIO

import logging
import urllib
from urllib import parse

from onshape_api.api.api_base import Api
from onshape_api.assertions import assert_instance_type, assert_workspace
from onshape_api.paths.api_path import api_path
from onshape_api.paths.instance_type import InstanceType
from onshape_api.paths.paths import ElementPath, InstancePath


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
    configuration: str,
    size: ThumbnailSize = ThumbnailSize.STANDARD,
) -> BytesIO:
    """Returns the thumbnail of a given element."""
    path = api_path("thumbnails", element_path, ElementPath)
    if configuration:
        path += "/ac/" + configuration
    path += "/s/" + size
    return BytesIO(api.get(path, is_json=False).content)
