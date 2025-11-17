from datetime import datetime
from enum import StrEnum
from io import BytesIO
from urllib import parse


from onshape_api.api.api_base import Api
from onshape_api.assertions import assert_instance_type
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
    """Returns the thumbnail for a given element in a workspace or version."""
    assert_instance_type(element_path, InstanceType.WORKSPACE, InstanceType.VERSION)

    path = api_path("thumbnails", element_path, ElementPath)
    path += "/s/" + size

    return BytesIO(api.get(path, is_json=False).content)


def get_thumbnail_from_workspace(
    api: Api,
    element_path: ElementPath,
    size: ThumbnailSize = ThumbnailSize.STANDARD,
    configuration: str | None = None,
) -> BytesIO:
    """Returns the thumbnail of a given element in a workspace, optionally with a specific configuration.

    Compared to get_element_thumbnail, this endpoint supports configurations but is limited to only workspaces.
    """
    assert_instance_type(element_path, InstanceType.WORKSPACE)
    path = api_path("thumbnails", element_path, ElementPath)

    if configuration:
        path += "/ac/" + configuration

    path += "/s/" + size

    query = {"rejectEmpty": True, "requireConfigMatch": True}

    return BytesIO(api.get(path, query=query, is_json=False).content)


def get_thumbnail_id(
    api: Api,
    element_path: ElementPath,
    configuration: str | None = None,
) -> str:
    query = {
        "includeParts": True,
        "includeAssemblies": True,
        "includeCompositeParts": True,
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
