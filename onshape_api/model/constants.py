from onshape_api.paths.doc_path import url_to_instance_path

STD_PATH = url_to_instance_path(
    "https://cad.onshape.com/documents/12312312345abcabcabcdeff/w/a855e4161c814f2e9ab3698a"
)
"""The path to the Onshape std."""

START_VERSION_NAME = "Start"
"""The name of the base version inside every Onshape document."""

IDENTITY_TRANSFORM = [
    1.0,
    0.0,
    0.0,
    0.0,
    0.0,
    1.0,
    0.0,
    0.0,
    0.0,
    0.0,
    1.0,
    0.0,
    0.0,
    0.0,
    0.0,
    1.0,
]
"""The identity transform."""
