from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.core import get_db
from app.models import User
from app.middleware.auth import get_current_user_from_token

# Security scheme for dependency injection
security = HTTPBearer()


async def get_current_user(
    request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """
    FastAPI dependency to get the current authenticated user.

    Extracts the JWT token from the Authorization header,
    validates it, and returns the corresponding User object.

    Raises HTTPException 401 if authentication fails.
    """
    user_id = await get_current_user_from_token(request)

    try:
        user_uuid = UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID in token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


# Type alias for cleaner route signatures
CurrentUser = Annotated[User, Depends(get_current_user)]
