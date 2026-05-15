"""A miscellaneous collection of utilities for working with strings."""

import re
import json


def to_json(value: dict | list) -> str:
    """Converts a dict or list to a pretty print string."""
    return json.dumps(value, indent=2)


def indent(string: str) -> str:
    lines = string.splitlines(keepends=True)
    return "".join(["    " + line for line in lines])


def quote(string: str) -> str:
    """Adds quotes around string."""
    return '"' + string + '"'


def parens(string: str) -> str:
    """Adds parentheses around string."""
    return "(" + string + ")"


def lower_first(string: str) -> str:
    return string[0].lower() + string[1:]


def upper_first(string: str) -> str:
    """A variant of capitalize which doesn't lower case the other words."""
    return string[0].upper() + string[1:]


def camel_case(name: str, capitalize: bool = False) -> str:
    """Converts a name separated by underscores into camel case."""
    words = name.split("_")
    words = [word.capitalize() for word in words]
    result = "".join(words)
    return result if capitalize else lower_first(result)


def _display_name(words: list[str]) -> str:
    words[0] = words[0].capitalize()
    words[1:] = [word.lower() for word in words[1:]]
    return " ".join(words)


def value_display_name(value: str) -> str:
    return _display_name(value.split("_"))


def display_name(parameter_name: str) -> str:
    """Converts a camel case parameter name to sentence case.

    Examples:
        myEnum -> My enum
        MyValue -> My value
    """
    words = re.findall("[a-zA-Z][^A-Z]*", parameter_name)
    return _display_name(words)
