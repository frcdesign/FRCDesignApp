import re
from onshape_api.api.api_base import Api
from onshape_api.endpoints.versions import get_latest_version, get_versions
from onshape_api.model.constants import STD_PATH


def get_latest_std_version(api: Api) -> str:
    """Returns the name of the latest version of the Onshape std."""
    response = get_latest_version(api, STD_PATH)
    version_number = _extract_version_number(response["name"])
    if version_number == None:
        raise ValueError("Failed to parse Onshape std version: " + response["name"])
    return version_number


def get_std_versions(api: Api) -> list[str]:
    """Returns a list of the names of all versions of the Onshape std.

    The versions are in reverse chronological order, with the oldest version first.
    """
    # Omit "Start" version
    response = get_versions(api, STD_PATH)[1:]
    version_numbers = map(
        lambda version: _extract_version_number(version["name"]), response
    )
    return [number for number in version_numbers if number != None]


def _extract_version_number(version_name: str) -> str | None:
    match = re.fullmatch(r"(\d+)\.0", version_name)
    if match == None:
        return None
    return match.group(1)
