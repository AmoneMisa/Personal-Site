"""Owner-only content handler — one place to script the whole site from JSON.

Everything here is guarded by :func:`require_owner` (static ``X-Owner-Key`` header
or an admin Bearer token), so it is meant to be driven from cURL/Postman.

Surfaces
--------
* ``POST   /owner/translations/apply`` — bulk upsert/delete translation keys.
* ``GET    /owner/items/{entity}``      — list rows of a whitelisted entity.
* ``POST   /owner/items/{entity}``      — create a row from a JSON object.
* ``PATCH  /owner/items/{entity}/{id}`` — patch a row.
* ``DELETE /owner/items/{entity}/{id}`` — delete a row.
* ``POST   /owner/apply``               — unified payload: translations + settings
  + header menu in a single call.

Entities with nested children (footer blocks+links, tabs-with-background+features)
are intentionally excluded from the generic CRUD — use their dedicated routers,
which understand the relationships.
"""

import json
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_session
from ..deps.require_owner import require_owner
from ..models.models import (
    AnimatedText,
    Contact,
    FeatureCard,
    HeaderMenu,
    Language,
    OfferCard,
    PriceCard,
    Service,
    ServiceCategory,
    Setting,
    TabsUnderbutton,
    Testimonial,
    TranslationKey,
    TranslationValue,
)
from ..utils.redis_client import get_redis

router = APIRouter(prefix="/owner", tags=["Owner"])


def api_error(code: str, message: str, status: int = 400, field: str | None = None):
    detail = {"code": code, "message": message}
    if field:
        detail["field"] = field
    raise HTTPException(status_code=status, detail=detail)


# ---------------------------------------------------------
# Whitelisted flat entities for generic CRUD.
#   name -> (Model, redis_cache_key | None)
# ---------------------------------------------------------
ENTITIES: dict[str, tuple[type, str | None]] = {
    "testimonials": (Testimonial, "testimonials"),
    "feature-cards": (FeatureCard, None),
    "offer-cards": (OfferCard, "offer-cards"),
    "price-cards": (PriceCard, None),
    "service-categories": (ServiceCategory, None),
    "services": (Service, None),
    "tabs-underbutton": (TabsUnderbutton, None),
    "animated-text": (AnimatedText, "animated_text"),
    "contacts": (Contact, None),
    "languages": (Language, None),
}


def _resolve(entity: str) -> tuple[type, str | None]:
    if entity not in ENTITIES:
        api_error(
            "UNKNOWN_ENTITY",
            f"Неизвестная сущность '{entity}'. Доступно: {', '.join(sorted(ENTITIES))}",
            status=404,
        )
    return ENTITIES[entity]


def _columns(model: type) -> set[str]:
    return set(model.__table__.columns.keys())


def _filter_payload(model: type, data: dict, *, for_create: bool) -> dict:
    """Keep only real column names; drop unknown keys and read-only timestamps."""
    cols = _columns(model)
    readonly = {"createdAt", "updatedAt"}
    clean = {k: v for k, v in data.items() if k in cols and k not in readonly}
    if for_create:
        # Generate a string UUID id when the model uses one and none was supplied.
        pk = list(model.__table__.primary_key.columns)[0]
        if pk.name == "id" and "id" not in clean and isinstance(pk.type.python_type, type):
            if pk.type.python_type is str:
                clean["id"] = str(uuid.uuid4())
    return clean


def _serialize(obj: Any) -> dict:
    model = type(obj)
    return {c: getattr(obj, c) for c in _columns(model)}


async def _invalidate(cache_key: str | None):
    if cache_key:
        await get_redis().delete(cache_key)


# ---------------------------------------------------------
# Generic item CRUD
# ---------------------------------------------------------
@router.get("/items/{entity}")
async def list_items(
    entity: str,
    session: AsyncSession = Depends(get_session),
    _owner=Depends(require_owner),
):
    model, _ = _resolve(entity)
    rows = (await session.execute(select(model))).scalars().all()
    return [_serialize(r) for r in rows]


@router.post("/items/{entity}")
async def create_item(
    entity: str,
    payload: dict[str, Any],
    session: AsyncSession = Depends(get_session),
    _owner=Depends(require_owner),
):
    model, cache_key = _resolve(entity)
    data = _filter_payload(model, payload, for_create=True)
    if not data:
        api_error("EMPTY_PAYLOAD", "Нет ни одного известного поля для создания", status=422)

    obj = model(**data)
    session.add(obj)
    await session.commit()
    await session.refresh(obj)
    await _invalidate(cache_key)

    return {"status": "created", "item": _serialize(obj)}


@router.patch("/items/{entity}/{item_id}")
async def update_item(
    entity: str,
    item_id: str,
    payload: dict[str, Any],
    session: AsyncSession = Depends(get_session),
    _owner=Depends(require_owner),
):
    model, cache_key = _resolve(entity)
    obj = await session.get(model, item_id)
    if obj is None:
        api_error("ITEM_NOT_FOUND", f"{entity}: запись '{item_id}' не найдена", status=404)

    data = _filter_payload(model, payload, for_create=False)
    for k, v in data.items():
        setattr(obj, k, v)

    await session.commit()
    await session.refresh(obj)
    await _invalidate(cache_key)

    return {"status": "updated", "item": _serialize(obj)}


@router.delete("/items/{entity}/{item_id}")
async def delete_item(
    entity: str,
    item_id: str,
    session: AsyncSession = Depends(get_session),
    _owner=Depends(require_owner),
):
    model, cache_key = _resolve(entity)
    obj = await session.get(model, item_id)
    if obj is None:
        api_error("ITEM_NOT_FOUND", f"{entity}: запись '{item_id}' не найдена", status=404)

    await session.delete(obj)
    await session.commit()
    await _invalidate(cache_key)

    return {"status": "deleted", "id": item_id}


# ---------------------------------------------------------
# Translations — easy apply
# ---------------------------------------------------------
def _normalize_value_for_db(value):
    # Match translations.py: values live JSON-encoded inside the JSON column.
    if value is None:
        return "null"
    if isinstance(value, (str, int, float, dict, list)):
        return json.dumps(value, ensure_ascii=False)
    api_error("INVALID_VALUE_TYPE", f"Неподдерживаемый тип значения: {type(value)}", status=422)


class TranslationUpsert(BaseModel):
    key: str = Field(..., min_length=1)
    values: dict[str, Any] = {}  # {lang_code: value}


class TranslationsApply(BaseModel):
    upsert: list[TranslationUpsert] = []
    delete: list[str] = []


async def _apply_translations(session: AsyncSession, payload: TranslationsApply) -> dict:
    languages = {
        lang.code: lang
        for lang in (await session.execute(select(Language))).scalars().all()
    }
    if not languages and payload.upsert:
        api_error("NO_LANGUAGES", "В системе не настроены языки", status=400)

    existing_keys = {
        k.key: k for k in (await session.execute(select(TranslationKey))).scalars().all()
    }

    touched_langs: set[str] = set()

    # --- upsert ---
    for item in payload.upsert:
        key_row = existing_keys.get(item.key)
        if not key_row:
            key_row = TranslationKey(key=item.key)
            session.add(key_row)
            await session.flush()
            existing_keys[item.key] = key_row

        for lang_code, raw in item.values.items():
            lang = languages.get(lang_code)
            if not lang:
                api_error("LANGUAGE_NOT_FOUND", f"Язык '{lang_code}' не найден", field="values", status=404)

            value = _normalize_value_for_db(raw)
            existing = await session.scalar(
                select(TranslationValue).where(
                    TranslationValue.translationKeyId == key_row.id,
                    TranslationValue.languageId == lang.id,
                )
            )
            if existing:
                existing.value = value
            else:
                session.add(
                    TranslationValue(
                        translationKeyId=key_row.id,
                        languageId=lang.id,
                        value=value,
                    )
                )
            touched_langs.add(lang_code)

    # --- delete ---
    if payload.delete:
        key_rows = (
            await session.execute(
                select(TranslationKey).where(TranslationKey.key.in_(payload.delete))
            )
        ).scalars().all()
        if key_rows:
            key_ids = [k.id for k in key_rows]
            await session.execute(
                TranslationValue.__table__.delete().where(
                    TranslationValue.translationKeyId.in_(key_ids)
                )
            )
            for k in key_rows:
                await session.delete(k)
            # Deleting keys affects every language cache.
            touched_langs.update(languages.keys())

    await session.commit()

    redis = get_redis()
    for code in touched_langs:
        await redis.delete(f"translations:{code}")

    return {
        "upserted": len(payload.upsert),
        "deleted": len(payload.delete),
        "languages": sorted(touched_langs),
    }


@router.post("/translations/apply")
async def translations_apply(
    payload: TranslationsApply,
    session: AsyncSession = Depends(get_session),
    _owner=Depends(require_owner),
):
    result = await _apply_translations(session, payload)
    return {"status": "ok", **result}


# ---------------------------------------------------------
# Unified apply — translations + settings + header menu
# ---------------------------------------------------------
class OwnerApply(BaseModel):
    translations: TranslationsApply | None = None
    settings: dict[str, Any] | None = None
    headerMenu: list[Any] | None = None


@router.post("/apply")
async def owner_apply(
    payload: OwnerApply,
    session: AsyncSession = Depends(get_session),
    _owner=Depends(require_owner),
):
    result: dict[str, Any] = {}
    redis = get_redis()

    if payload.translations is not None:
        result["translations"] = await _apply_translations(session, payload.translations)

    if payload.settings is not None:
        for key, value in payload.settings.items():
            row = await session.get(Setting, key)
            if row is None:
                session.add(Setting(key=key, value=value))
            else:
                row.value = value
        await session.commit()
        await redis.delete("settings")
        result["settings"] = {"count": len(payload.settings)}

    if payload.headerMenu is not None:
        row = (await session.execute(select(HeaderMenu))).scalars().first()
        if row is None:
            session.add(HeaderMenu(json=payload.headerMenu))
        else:
            row.json = payload.headerMenu
        await session.commit()
        await redis.delete("header-menu")
        result["headerMenu"] = {"items": len(payload.headerMenu)}

    return {"status": "ok", **result}
