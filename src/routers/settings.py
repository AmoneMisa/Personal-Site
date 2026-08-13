"""Site-wide settings key/value store.

Public reads (the frontend fetches SEO defaults at SSR time); owner-only writes.
Values are free-form JSON, so a key can hold a string, number, object or list —
e.g. ``seo.ogImage`` -> "https://.../og.png", ``seo.social`` -> {"github": "..."}.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_session
from ..deps.require_owner import require_owner
from ..models.models import Setting
from ..utils.redis_client import get_redis

router = APIRouter(prefix="/settings", tags=["Settings"])

CACHE_KEY = "settings"
CACHE_TTL = 3600


def api_error(code: str, message: str, status: int = 400, field: str | None = None):
    detail = {"code": code, "message": message}
    if field:
        detail["field"] = field
    raise HTTPException(status_code=status, detail=detail)


async def _all_settings(session: AsyncSession) -> dict[str, Any]:
    rows = (await session.execute(select(Setting))).scalars().all()
    return {row.key: row.value for row in rows}


async def _invalidate():
    await get_redis().delete(CACHE_KEY)


# ---------------------------------------------------------
# GET /settings  (public, cached) -> {key: value, ...}
# ---------------------------------------------------------
@router.get("")
async def get_settings(session: AsyncSession = Depends(get_session)):
    import json

    redis = get_redis()
    cached = await redis.get(CACHE_KEY)
    if cached is not None:
        return json.loads(cached)

    data = await _all_settings(session)
    await redis.set(CACHE_KEY, json.dumps(data, ensure_ascii=False), ex=CACHE_TTL)
    return data


# ---------------------------------------------------------
# GET /settings/{key}  (public) -> value  (404 if missing)
# ---------------------------------------------------------
@router.get("/{key}")
async def get_setting(key: str, session: AsyncSession = Depends(get_session)):
    row = await session.get(Setting, key)
    if row is None:
        api_error("SETTING_NOT_FOUND", f"Настройка '{key}' не найдена", status=404)
    return row.value


# ---------------------------------------------------------
# PUT /settings  (owner) — bulk upsert {key: value, ...}
# ---------------------------------------------------------
class SettingsBulk(BaseModel):
    # arbitrary {key: json-value} map
    model_config = {"extra": "allow"}


@router.put("")
async def upsert_settings(
    payload: dict[str, Any],
    session: AsyncSession = Depends(get_session),
    _owner=Depends(require_owner),
):
    if not isinstance(payload, dict) or not payload:
        api_error("EMPTY_PAYLOAD", "Ожидается непустой объект {key: value}", status=422)

    for key, value in payload.items():
        if not isinstance(key, str) or not key.strip():
            api_error("INVALID_KEY", "Ключ настройки должен быть непустой строкой", status=422)

        row = await session.get(Setting, key)
        if row is None:
            session.add(Setting(key=key, value=value))
        else:
            row.value = value

    await session.commit()
    await _invalidate()

    return {"status": "ok", "count": len(payload), "settings": await _all_settings(session)}


# ---------------------------------------------------------
# DELETE /settings/{key}  (owner)
# ---------------------------------------------------------
@router.delete("/{key}")
async def delete_setting(
    key: str,
    session: AsyncSession = Depends(get_session),
    _owner=Depends(require_owner),
):
    row = await session.get(Setting, key)
    if row is None:
        api_error("SETTING_NOT_FOUND", f"Настройка '{key}' не найдена", status=404)

    await session.delete(row)
    await session.commit()
    await _invalidate()

    return {"status": "deleted", "key": key}
