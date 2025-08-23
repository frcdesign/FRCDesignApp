from typing import Type
from urllib import parse
from onshape_api.paths.base_path import BasePath
from onshape_api.paths.doc_path import DocumentPath


def api_path(
    route: str,
    path: BasePath | None = None,
    path_type: Type[BasePath] | None = None,
    end_route: str | None = None,
    end_id: str | None = None,
    feature_id: str | None = None,
    skip_document_d: bool = False,
) -> str:
    """Constructs a path suitable for consumption by an API.

    Args:
        service: The name of the base Onshape service. It may optionally start with a slash.
        path: A path to use.
        path_type: The actual type of the path. Required when path is provided.
            This is necessary to prevent issues with passing higher order paths.
        end_route: The portion of the route following the path. Note the entire end_route is appended.
            The end_route may optionally start with a slash.
        end_id: If included, "/<end_id>" is appended.
            The end_id is escaped to prevent issues with slashes in the id.
        feature_id: If included, /featureId/<feature_id> is appended.
            The feature_id is escaped to prevent issues with slashes in the id.
        skip_document_d: If True and path_type is DocumentPath, the /d/ portion of the documentId will be omitted.
    """
    api_path = "" if route.startswith("/") else "/" + route

    if path is not None:
        if path_type is None:
            raise ValueError("path_type must be provided alongside path")
        if isinstance(path, DocumentPath) and skip_document_d:
            api_path += "/" + path.document_id
        else:
            api_path += path_type.to_api_path(path)
    if end_route is not None:
        api_path += "" if end_route.startswith("/") else "/" + end_route
    if end_id is not None:
        api_path += "/" + parse.quote(end_id, safe="")
    if feature_id is not None:
        api_path += "/featureId/" + parse.quote(feature_id, safe="")
    return api_path
