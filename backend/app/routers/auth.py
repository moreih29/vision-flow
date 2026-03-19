from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.user import Token, UserCreate, UserLogin, UserResponse
from app.services.auth import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Register a new user."""
    user = await auth_service.create_user(db, user_in)
    return UserResponse.model_validate(user)


@router.post("/login", response_model=Token)
async def login(
    credentials: UserLogin,
    db: AsyncSession = Depends(get_db),
) -> Token:
    """Authenticate a user and return a JWT token."""
    user = await auth_service.authenticate_user(
        db, credentials.email, credentials.password
    )
    access_token = auth_service.create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(days=settings.access_token_expire_days),
    )
    return Token(access_token=access_token)


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Get current logged-in user information."""
    return UserResponse.model_validate(current_user)
