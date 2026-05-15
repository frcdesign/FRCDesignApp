from enum import StrEnum
import http
from onshape_api.api.api_base import Api
from onshape_api.exceptions import OnshapeException
from onshape_api.paths.api_path import api_path
from onshape_api.paths.doc_path import DocumentPath


class Permission(StrEnum):
    READ = "READ"
    WRITE = "WRITE"
    COMMENT = "COMMENT"
    RESHARE = "RESHARE"
    EXPORT = "EXPORT"
    DELETE = "DELETE"
    LINK = "LINK"
    COPY = "COPY"
    OWNER = "OWNER"


def get_permissions(api: Api, document_path: DocumentPath) -> list[Permission]:
    try:
        permissions = api.get(
            api_path(
                "documents",
                document_path,
                DocumentPath,
                "permissionset",
                skip_document_d=True,
            )
        )
    except OnshapeException as error:
        if error.status_code == http.HTTPStatus.FORBIDDEN:
            # If a document isn't shared at all, get permissions can return a 403 Forbidden, so report no perms in that case
            return []
        else:
            raise error
    return [Permission(permission) for permission in permissions]


def has_permissions(
    api: Api, document_path: DocumentPath, *needed_permissions: Permission
) -> bool:
    permissions = get_permissions(api, document_path)
    for permission in needed_permissions:
        if permission not in permissions:
            return False
    return True
