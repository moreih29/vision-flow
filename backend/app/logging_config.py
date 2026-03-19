"""구조화된 로깅 설정 모듈.

Python 표준 logging 라이브러리를 사용하여 JSON 형식의 로그를 출력합니다.
로그 레벨은 환경변수 LOG_LEVEL로 설정 가능합니다 (기본값: INFO).
"""

import json
import logging
import logging.config
import os
import traceback
from datetime import datetime, timezone


class JsonFormatter(logging.Formatter):
    """로그 레코드를 JSON 형식으로 직렬화하는 포매터."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry: dict = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # extra 필드 추가 (표준 LogRecord 속성 제외)
        _standard_attrs = {
            "name", "msg", "args", "levelname", "levelno", "pathname",
            "filename", "module", "exc_info", "exc_text", "stack_info",
            "lineno", "funcName", "created", "msecs", "relativeCreated",
            "thread", "threadName", "processName", "process", "message",
            "taskName",
        }
        for key, value in record.__dict__.items():
            if key not in _standard_attrs:
                log_entry[key] = value

        # 예외 정보 포함
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        elif record.exc_text:
            log_entry["exception"] = record.exc_text

        return json.dumps(log_entry, ensure_ascii=False, default=str)


def setup_logging() -> None:
    """애플리케이션 로깅을 초기화합니다.

    환경변수 LOG_LEVEL을 읽어 로그 레벨을 설정합니다.
    모든 로그는 JSON 형식으로 stdout에 출력됩니다.
    """
    log_level_str = os.environ.get("LOG_LEVEL", "INFO").upper()
    log_level = getattr(logging, log_level_str, logging.INFO)

    logging_config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "json": {
                "()": JsonFormatter,
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "stream": "ext://sys.stdout",
                "formatter": "json",
            },
        },
        "root": {
            "level": log_level,
            "handlers": ["console"],
        },
        # uvicorn 로거도 동일한 포매터 사용
        "loggers": {
            "uvicorn": {
                "handlers": ["console"],
                "level": log_level,
                "propagate": False,
            },
            "uvicorn.access": {
                "handlers": ["console"],
                "level": log_level,
                "propagate": False,
            },
            "uvicorn.error": {
                "handlers": ["console"],
                "level": log_level,
                "propagate": False,
            },
        },
    }

    logging.config.dictConfig(logging_config)
    logging.getLogger(__name__).info(
        "로깅 초기화 완료",
        extra={"log_level": log_level_str},
    )
