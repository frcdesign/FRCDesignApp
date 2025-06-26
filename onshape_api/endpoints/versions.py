from onshape_api.paths.api_path import api_path
from onshape_api.api.api_base import Api
from onshape_api.paths.instance_type import InstanceType
from onshape_api.paths.paths import DocumentPath, InstancePath


def get_versions(
    api: Api,
    document_path: DocumentPath,
    offset: int = 0,
    limit: int = 0,
) -> list[dict]:
    """Fetches a list of versions of a document.

    Versions are returned in chronological order, with the oldest version ("Start") first.

    Args:
        offset: A starting offset to apply. Does not support negative indexing.
        limit: The max number of versions to return.
    """
    return api.get(
        api_path("documents", document_path, DocumentPath, "versions"),
        query={offset: offset, limit: limit},
    )


def get_latest_version_path(api: Api, document_path: DocumentPath) -> InstancePath:
    version_id = get_latest_version(api, document_path)["id"]
    return InstancePath.from_path(
        document_path, version_id, instance_type=InstanceType.VERSION
    )


def get_latest_version(api: Api, document_path: DocumentPath) -> dict:
    return get_versions(api, document_path)[-1]


def create_version(
    api: Api,
    instance_path: InstancePath,
    version_name: str,
    description: str,
) -> dict:
    """Creates a new version of a document from a given instance."""
    body = {
        "name": version_name,
        "description": description,
    }
    body.update(InstancePath.to_api_object(instance_path))
    return api.post(
        api_path("documents", instance_path, DocumentPath, "versions"),
        body=body,
    )
