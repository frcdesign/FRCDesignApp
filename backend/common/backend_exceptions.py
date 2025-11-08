from abc import ABC
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
