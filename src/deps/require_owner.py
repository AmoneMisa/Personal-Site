"""Owner-level authorization for the content-editing API.

Two accepted credentials, in priority order:

1. ``X-Owner-Key`` header matching ``settings.OWNER_API_KEY`` — a long-lived
   static secret meant for frictionless cURL/Postman scripting (no login step).
2. A ``Bearer`` **admin** JWT — the same token issued by ``POST /auth/login``.

Either one grants access. The static-key path is disabled when
``OWNER_API_KEY`` is unset, so a deployment that never configures it falls back
to admin-JWT-only with no extra surface area.
"""

import hmac

from fastapi import Depends, Header, HTTPException
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.jwt import ALGORITHM, SECRET_KEY
from ..config import settings
from ..db.session import get_session
from ..models.models import User


def _auth_error(code: str, message: str, status: int = 401):
    raise HTTPException(status_code=status, detail={"code": code, "message": message})


async def require_owner(
    x_owner_key: str | None = Header(default=None, alias="X-Owner-Key"),
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_session),
):
    # 1) Static owner key (constant-time compare to avoid leaking length/prefix).
    configured = settings.OWNER_API_KEY
    if x_owner_key is not None:
        if configured and hmac.compare_digest(x_owner_key, configured):
            return {"owner": True, "via": "api_key"}
        _auth_error("INVALID_OWNER_KEY", "Неверный owner-ключ")

    # 2) Admin JWT (Authorization: Bearer <token>).
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        except JWTError:
            _auth_error("INVALID_TOKEN", "Неверный токен")

        user = (
            await db.execute(select(User).where(User.id == payload.get("id")))
        ).scalar_one_or_none()

        if not user:
            _auth_error("USER_NOT_FOUND", "Пользователь не найден")
        if user.deleted:
            _auth_error("ACCOUNT_DELETED", "Аккаунт помечен на удаление", status=403)
        if user.role != "admin":
            _auth_error("FORBIDDEN", "Доступ только для владельца/администратора", status=403)

        return user

    _auth_error(
        "OWNER_AUTH_REQUIRED",
        "Требуется заголовок X-Owner-Key или Bearer админ-токен",
    )
