from enum import StrEnum
import re


class Vendor(StrEnum):
    AM = "AM"
    LAI = "LAI"
    MCM = "MCM"
    REDUX = "Redux"
    REV = "REV"
    SDS = "SDS"
    SWYFT = "Swyft"
    TTB = "TTB"
    VEX = "VEX"
    WCP = "WCP"


def parse_vendor(name: str) -> Vendor | None:
    match = re.search(r"\((\w+)\)$", name)
    if not match:
        return None
    vendor_str = match.group(1)
    return next((vendor for vendor in Vendor if vendor == vendor_str), None)
