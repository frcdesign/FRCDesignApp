from enum import StrEnum


class InstanceType(StrEnum):
    """Represents the type of a specific instance of a document."""

    WORKSPACE = "w"
    """Represents an editable workspace in a document."""
    VERSION = "v"
    """Represents a version of a document."""
    MICROVERSION = "m"
    """Represents an entry in the edit history of a document."""

    @classmethod
    def __contains__(cls, item):
        try:
            cls(item)
        except ValueError:
            return False
        return True


def get_instance_type_key(instance_type: InstanceType) -> str:
    """Returns workspaceId, versionId, or microversionId depending on the path's InstanceType."""
    match instance_type:
        case InstanceType.WORKSPACE:
            return "workspaceId"
        case InstanceType.VERSION:
            return "versionId"
        case InstanceType.MICROVERSION:
            return "microversionId"
