"""공통 에러 핸들러 모듈.

FastAPI 앱에 등록할 예외 핸들러를 정의합니다.
모든 에러는 일관된 JSON 형식으로 응답합니다:
  {"error": {"code": "...", "message": "...", "details": [...]}}
"""

import logging
import traceback

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


def _error_response(code: str, message: str, details: list | None = None) -> dict:
    """표준 에러 응답 딕셔너리를 생성합니다."""
    return {"error": {"code": code, "message": message, "details": details or []}}


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """HTTPException을 표준 에러 형식으로 변환합니다."""
    # detail이 문자열이 아닌 경우(dict 등)도 처리
    message = exc.detail if isinstance(exc.detail, str) else str(exc.detail)

    # HTTP 상태 코드에 맞는 에러 코드 문자열 매핑
    code_map = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
        409: "CONFLICT",
        422: "UNPROCESSABLE_ENTITY",
        429: "TOO_MANY_REQUESTS",
    }
    code = code_map.get(exc.status_code, f"HTTP_{exc.status_code}")

    return JSONResponse(
        status_code=exc.status_code,
        content=_error_response(code, message),
        headers=getattr(exc, "headers", None),
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """RequestValidationError(422)를 필드별 에러 상세 정보와 함께 반환합니다."""
    details = []
    for error in exc.errors():
        # loc: ('body', 'field_name') 또는 ('query', 'param_name') 형태
        loc = error.get("loc", [])
        field = ".".join(str(part) for part in loc[1:]) if len(loc) > 1 else str(loc[0]) if loc else ""
        details.append(
            {
                "field": field,
                "message": error.get("msg", ""),
                "type": error.get("type", ""),
            }
        )

    return JSONResponse(
        status_code=422,
        content=_error_response(
            code="VALIDATION_ERROR",
            message="요청 데이터 유효성 검사에 실패했습니다.",
            details=details,
        ),
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """처리되지 않은 예외를 500 에러로 변환합니다.

    스택트레이스는 로그에만 기록하고, 사용자에게는 일반 메시지만 반환합니다.
    """
    logger.error(
        "처리되지 않은 예외 발생: %s %s",
        request.method,
        request.url,
        exc_info=True,
        extra={
            "stack_trace": traceback.format_exc(),
            "path": str(request.url),
            "method": request.method,
        },
    )

    return JSONResponse(
        status_code=500,
        content=_error_response(
            code="INTERNAL_SERVER_ERROR",
            message="서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        ),
    )


def register_error_handlers(app: FastAPI) -> None:
    """FastAPI 앱에 공통 에러 핸들러를 등록합니다."""
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, generic_exception_handler)
