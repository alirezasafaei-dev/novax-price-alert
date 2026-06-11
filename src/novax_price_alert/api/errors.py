from fastapi import HTTPException, status

from novax_price_alert.api.i18n import AUTH_INVALID_TOKEN, GENERIC_NOT_FOUND


class NotFoundError(HTTPException):
    def __init__(self, detail: str = GENERIC_NOT_FOUND) -> None:
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class BadRequestError(HTTPException):
    def __init__(self, detail: str) -> None:
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


class UnauthorizedError(HTTPException):
    def __init__(self, detail: str = AUTH_INVALID_TOKEN) -> None:
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)
