from backend.common.models import (
    Configuration,
    EnumConfigurationParameter,
    EnumOption,
    Vendor,
)
from backend.common.vendors import parse_vendors


def test_parse_vendor_name():
    assert parse_vendors("VEX Part") == [Vendor.VEX]
    assert parse_vendors("My Part (WCP) (Other)") == [Vendor.WCP]
    assert parse_vendors("ReDux part") == [Vendor.REDUX]
    assert parse_vendors("Thrifty part") == []


def test_parse_vendor_configurations():
    parameter = EnumConfigurationParameter(
        name="Vendor",
        id="test",
        default="VEX",
        options=[
            EnumOption(id="test1", name="VEXpro"),
            EnumOption(id="test2", name="Test (WCP)"),
            EnumOption(id="test3", name="REV Robotics"),
            EnumOption(id="test4", name="AndyMark"),
        ],
    )
    parameters = Configuration(parameters=[parameter])

    assert sorted(parse_vendors("Test part", parameters)) == sorted(
        [
            Vendor.VEX,
            Vendor.WCP,
            Vendor.REV,
            Vendor.AM,
        ]
    )
