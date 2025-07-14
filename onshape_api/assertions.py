from onshape_api.paths.instance_type import InstanceType
from onshape_api.paths.doc_path import InstancePath


def assert_instance_type(path: InstancePath, *instance_types: InstanceType) -> None:
    if path.instance_type not in instance_types:
        expected_types = " or ".join(type.name for type in instance_types)
        raise ValueError(
            f"The given path must be {expected_types}, got {path.instance_type}"
        )


def assert_workspace(path: InstancePath) -> None:
    """Asserts the given path is a workspace."""
    return assert_instance_type(path, InstanceType.WORKSPACE)


def assert_version(path: InstancePath) -> None:
    """Asserts the given path is a version."""
    return assert_instance_type(path, InstanceType.VERSION)
