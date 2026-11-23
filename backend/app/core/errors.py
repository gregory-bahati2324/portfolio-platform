import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DataError
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("app.errors")


def _err(status: int, code: str, message: str, details=None) -> JSONResponse:
    body: dict = {"error": {"code": code, "message": message}}
    if details is not None:
        body["error"]["details"] = details
    return JSONResponse(status_code=status, content=body)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def http_exc(_: Request, exc: StarletteHTTPException):
        return _err(exc.status_code, "http_error", str(exc.detail))

    @app.exception_handler(RequestValidationError)
    async def validation_exc(_: Request, exc: RequestValidationError):
        details = [
            {"field": ".".join(str(p) for p in e["loc"][1:]), "message": e["msg"]}
            for e in exc.errors()
        ]
        return _err(422, "validation_error", "Invalid request", details)

    @app.exception_handler(DataError)
    async def data_error(_: Request, exc: DataError):
        # e.g. PostgreSQL refuses NUL bytes or out-of-range values; that is bad input, not a server fault
        log.warning("rejected input the database cannot store")
        return _err(422, "validation_error", "Input contains characters or values that cannot be stored")

    @app.exception_handler(Exception)
    async def unhandled(_: Request, exc: Exception):
        log.exception("unhandled error")
        return _err(500, "internal_error", "Something went wrong")
