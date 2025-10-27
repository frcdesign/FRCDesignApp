import re
from backend.common.models import (
    ConfigurationParameters,
    ParameterType,
    Vendor,
    get_vendor_name,
)


def parse_name_vendor(name: str) -> Vendor | None:
    """Parse vendor information from element name.

    Checks the name for vendor abbreviations or full names.
    """
    # Search for all vendor matches in the name
    # Look for vendors in parentheses or standalone
    for match in re.finditer(r"\b(\w+)\b", name.upper()):
        vendor_str = match.group(1)

        # Check if it matches a vendor abbreviation
        if vendor := next(
            (vendor for vendor in Vendor if vendor.upper() == vendor_str), None
        ):
            return vendor


def parse_vendors(
    name: str, configuration: ConfigurationParameters | None = None
) -> list[Vendor]:
    """
    Parse vendor information from element name and/or configuration parameters.

    First checks the name for vendor abbreviations or full names.
    If no vendors found in name, checks configuration enum parameters for vendor values.
    """
    name_vendor = parse_name_vendor(name)
    if name_vendor:
        return [name_vendor]

    vendors: set[Vendor] = set()
    if not configuration:
        return []

    for param in configuration.parameters:
        if param.type != ParameterType.ENUM:
            continue

        # Check all option values against vendors
        for option in param.options:
            # Check if option matches vendor abbreviation
            vendor = parse_name_vendor(option.name)
            if vendor:
                vendors.add(vendor)
                continue

            vendor = next(
                (
                    vendor
                    for vendor in Vendor
                    if get_vendor_name(vendor).upper() == option.name.upper()
                ),
                None,
            )
            if vendor:
                vendors.add(vendor)

    return list(vendors)
