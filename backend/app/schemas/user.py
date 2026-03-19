import re
from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """비밀번호 강도 검증: 최소 8자, 대소문자, 숫자, 특수문자 각 1개 이상."""
        errors = []
        if len(v) < 8:
            errors.append("최소 8자 이상")
        if not re.search(r"[A-Z]", v):
            errors.append("영문 대문자 1개 이상")
        if not re.search(r"[a-z]", v):
            errors.append("영문 소문자 1개 이상")
        if not re.search(r"\d", v):
            errors.append("숫자 1개 이상")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>\[\]\\/'`~\-_=+;]", v):
            errors.append("특수문자 1개 이상")
        if errors:
            raise ValueError(f"비밀번호는 {', '.join(errors)}을(를) 포함해야 합니다.")
        return v


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    name: str | None = None
    password: str | None = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    is_admin: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    email: str | None = None
