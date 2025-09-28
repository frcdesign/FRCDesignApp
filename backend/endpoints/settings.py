from enum import IntEnum, StrEnum

import flask
from pydantic import BaseModel, field_validator

from backend.common import env
from backend.common import connect
from backend.common.app_access import get_app_access_level
from backend.common.connect import (
    get_api,
    get_db,
    get_onshape_setting,
    get_route_user_path,
    instance_path_route,
    user_path_route,
)
from backend.common.models import QuantityType, Unit
from backend.endpoints.cache import get_cache_version
from onshape_api.endpoints.documents import get_unit_info
from onshape_api.endpoints.settings import (
    Operation,
    Update,
    update_setting,
)
from onshape_api.endpoints.users import AccessLevel

router = flask.Blueprint("settings", __name__)


@router.get("/context-data" + instance_path_route())
def get_context_data(**kwargs):
    db = get_db()
    api = get_api(db)

    instance_path = connect.get_route_instance_path()

    max_access_level = get_app_access_level()
    current_access_level = AccessLevel.USER if env.IS_PRODUCTION else max_access_level

    unit_info = get_unit_info(api, instance_path)
    units = unit_info["defaultUnits"]["units"]

    angle_unit = get_default_unit(units, QuantityType.ANGLE)
    length_unit = get_default_unit(units, QuantityType.LENGTH)

    return {
        "maxAccessLevel": max_access_level,
        "currentAccessLevel": current_access_level,
        "angleUnit": angle_unit,
        "lengthUnit": length_unit,
        "anglePrecision": unit_info["unitsDisplayPrecision"][angle_unit],
        "lengthPrecision": unit_info["unitsDisplayPrecision"][length_unit],
        "realPrecision": 3,  # Always 3 to match Onshape since there's no setting for real numbers
        "cacheVersion": get_cache_version(db),
    }


def get_default_unit(units: list, quantity_type: QuantityType) -> Unit:
    return next(unit["value"] for unit in units if unit["key"] == quantity_type)


class SettingsVersion(IntEnum):
    V1 = 1


class Theme(StrEnum):
    SYSTEM = "system"
    LIGHT = "light"
    DARK = "dark"


class Settings(BaseModel):
    version: SettingsVersion = SettingsVersion.V1
    theme: Theme = Theme.SYSTEM

    @field_validator("version", mode="before")
    def validate_version(cls, v):
        if v is None:
            # No version is backwards compatible with V1
            return SettingsVersion.V1
        return v


@router.get("/settings" + user_path_route())
def get_settings(**kwargs):
    db = get_db()
    api = get_api(db)
    user_path = get_route_user_path()

    settings = get_onshape_setting(api, user_path, "settings", Settings)
    return settings.model_dump(exclude_none=True)


@router.post("/settings" + user_path_route())
def update_settings(**kwargs):
    db = get_db()
    api = get_api(db)

    user_path = get_route_user_path()
    theme = connect.get_body_arg("theme")
    update: Update = {
        "key": "settings",
        "field": "theme",
        "value": theme,
        "operation": Operation.SET,
    }
    update_setting(api, user_path, update)

    return {"success": True}
