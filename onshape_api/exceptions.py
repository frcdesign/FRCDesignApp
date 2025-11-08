import http


class ApiError(Exception):
    """The exception thrown by all Onshape API functions."""

    def __init__(
        self, message: str, status_code: http.HTTPStatus = http.HTTPStatus.BAD_REQUEST
    ):
        super().__init__(str(status_code) + ": " + message)
        self.message = message
        self.status_code = status_code

    def to_dict(self) -> dict:
        return {
            "type": "API_EXCEPTION",
            "message": self.message,
            "code": self.status_code,
        }
