import flask

from backend.common import env
from backend.common import connect
from backend.common.app_access import get_app_access_level
from backend.common.connect import (
    get_api,
    get_db,
    instance_path_route,
)
from backend.common.models import QuantityType, Unit
from backend.endpoints.cache import get_cache_version
from onshape_api.endpoints.documents import get_unit_info
from onshape_api.endpoints.users import AccessLevel

router = flask.Blueprint("context-data", __name__)


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
        "realPrecision": 3,  # Always 3 to match Onshape since there's no config for real numbers
        "cacheVersion": get_cache_version(db),
    }


def get_default_unit(units: list, quantity_type: QuantityType) -> Unit:
    return next(unit["value"] for unit in units if unit["key"] == quantity_type)
