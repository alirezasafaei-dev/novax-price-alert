from fastapi import HTTPException, status


class NotFoundError(HTTPException):
    def __init__(self, detail: str = "منبع مورد نظر یافت نشد") -> None:
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class BadRequestError(HTTPException):
    def __init__(self, detail: str) -> None:
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


class UnauthorizedError(HTTPException):
    def __init__(self, detail: str = "احراز هویت نشد. لطفاً وارد شوید.") -> None:
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)
