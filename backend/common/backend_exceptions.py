from abc import ABC
from email.policy import HTTP
from enum import StrEnum
from http import HTTPStatus
from onshape_api.endpoints.users import AccessLevel


class ExceptionType(StrEnum):
    HANDLED = "handled"
    SERVER = "server"
    CLIENT = "client"
    API = "api"


class BaseAppException(Exception, ABC):
    """Base class for all API exceptions."""

    def __init__(
        self,
        message: str,
        type: ExceptionType = ExceptionType.SERVER,
        status_code: HTTPStatus = HTTPStatus.INTERNAL_SERVER_ERROR,
    ):
        super().__init__()
        self.message = message
        self.type = type
        self.status_code = status_code

    def to_dict(self) -> dict:
        return {"type": self.type, "message": self.message}


class ServerException(BaseAppException):
    """Exceptions representing problems on the server which should never occur."""

    def __init__(
        self,
        message: str,
    ):
        super().__init__(
            message,
            type=ExceptionType.SERVER,
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
        )


class ClientException(BaseAppException):
    """An unexpected exception caused by the frontend doing something it never should do."""

    def __init__(self, message: str):
        super().__init__(
            message,
            status_code=HTTPStatus.BAD_REQUEST,
        )


class AuthException(BaseAppException):
    def __init__(self, access_level: AccessLevel):
        super().__init__(
            f"User has {access_level} access, which is not sufficient to access this resource",
            status_code=HTTPStatus.UNAUTHORIZED,
        )


class HandledException(BaseAppException):
    """Exceptions which are returned to the frontend to be displayed to the user directly."""

    def __init__(self, message: str):
        super().__init__(
            message, type=ExceptionType.HANDLED, status_code=HTTPStatus.BAD_REQUEST
        )


# class DocumentPermissionException(UserException):
#     """An exception indicating a user does not have the necessary permissions for one or more resources used by an endpoint."""

#     def __init__(
#         self,
#         missing_permission: Permission,
#         document_id: str,
#         document_name: str | None = None,
#     ):
#         super().__init__("MISSING_PERMISSION", HTTPStatus.UNAUTHORIZED)
#         self.missing_permission = missing_permission
#         self.document_id = document_id
#         self.document_name = document_name

#     def to_dict(self):
#         return {
#             "type": self.type,
#             "permission": self.missing_permission,
#             "documentId": self.document_id,
#             "documentName": self.document_name,
#         }


# def require_permissions(api: Api, path: DocumentPath, *needed_permissions: Permission):
#     """Throws an exception if the current user doesn't have given permissions for the given document."""
#     permissions = get_permissions(api, path)
#     if permissions == []:
#         raise DocumentPermissionException(Permission.READ, path.document_id)

#     for permission in needed_permissions:
#         if permission not in permissions:
#             try:
#                 document_name = get_document(api, path)["name"]
#             except:
#                 document_name = None
#             raise DocumentPermissionException(
#                 permission, path.document_id, document_name
#             )
