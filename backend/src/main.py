import asyncio
import os
import shutil
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .routers import pdf, convert, dockerhub, countryIndices
from .routers.pdf import pdf_storage_cleanup_loop
from .utils.pdf_doc_id import normalize_pdf_doc_id, pdf_doc_id_from_path
from .utils.public_tool_limits import (
    MAX_INDEX_BATCH_KEYS,
    valid_docker_query,
    valid_docker_repo,
    valid_docker_tag,
    valid_index_key,
)
from .utils.state_store import get_state_store


BACKEND_STATE_DIR = Path(os.getenv("BACKEND_STATE_DIR", "/var/app/state/backend"))
INDICES_REQUEST_CONCURRENCY = max(1, int(os.getenv("INDICES_REQUEST_CONCURRENCY", "2")))
DOCKERHUB_REQUEST_CONCURRENCY = max(1, int(os.getenv("DOCKERHUB_REQUEST_CONCURRENCY", "4")))
_indices_requests = asyncio.Semaphore(INDICES_REQUEST_CONCURRENCY)
_dockerhub_requests = asyncio.Semaphore(DOCKERHUB_REQUEST_CONCURRENCY)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Stateless tool API — no database. Only the PDF scratch-storage janitor runs.
    cleanup_task = asyncio.create_task(pdf_storage_cleanup_loop(), name="pdf_storage_cleanup_loop")
    try:
        yield
    finally:
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass


app = FastAPI(lifespan=lifespan)


def _known_index_key(key: str) -> bool:
    return valid_index_key(
        key,
        countryIndices.COUNTRY_CODES.keys(),
        lambda value: countryIndices.parse_us_state_code(value) is not None,
    )


async def _validate_indices_request(request: Request):
    if request.url.path == "/indices/bundle":
        key = request.query_params.get("key", "")
        if not _known_index_key(key):
            return JSONResponse(status_code=400, content={"detail": "Unknown index key"})
        return None

    if request.url.path == "/indices/bundles" and request.method == "POST":
        try:
            payload = await request.json()
        except ValueError:
            return JSONResponse(status_code=400, content={"detail": "Invalid JSON payload"})
        keys = payload.get("keys") if isinstance(payload, dict) else None
        if not isinstance(keys, list):
            return JSONResponse(status_code=400, content={"detail": "keys must be a list"})
        unique_keys = list(dict.fromkeys(str(key).strip() for key in keys if str(key).strip()))
        if len(unique_keys) > MAX_INDEX_BATCH_KEYS:
            return JSONResponse(
                status_code=413,
                content={"detail": f"At most {MAX_INDEX_BATCH_KEYS} index keys are allowed per request"},
            )
        if any(not _known_index_key(key) for key in unique_keys):
            return JSONResponse(status_code=400, content={"detail": "Payload contains an unknown index key"})
    return None


def _validate_dockerhub_request(request: Request):
    repo = request.query_params.get("repo", "")
    if not valid_docker_repo(repo):
        return JSONResponse(status_code=400, content={"detail": "Invalid Docker Hub repository"})

    tag = request.query_params.get("tag")
    if tag is not None and not valid_docker_tag(tag):
        return JSONResponse(status_code=400, content={"detail": "Invalid Docker tag"})

    query = request.query_params.get("q")
    if query is not None and not valid_docker_query(query):
        return JSONResponse(status_code=400, content={"detail": "Invalid Docker tag query"})

    variant = request.query_params.get("variant")
    if variant is not None and not valid_docker_query(variant):
        return JSONResponse(status_code=400, content={"detail": "Invalid Docker variant"})

    major = request.query_params.get("major")
    if major is not None:
        try:
            major_value = int(major)
        except ValueError:
            return JSONResponse(status_code=400, content={"detail": "Invalid Docker major version"})
        if not 0 < major_value <= 999:
            return JSONResponse(status_code=400, content={"detail": "Invalid Docker major version"})
    return None


@app.middleware("http")
async def protect_public_tool_fanout(request: Request, call_next):
    """Bound cache cardinality and external fan-out on public utility endpoints."""
    if request.url.path.startswith("/indices/"):
        invalid = await _validate_indices_request(request)
        if invalid is not None:
            return invalid
        async with _indices_requests:
            return await call_next(request)

    if request.url.path.startswith("/dockerhub/"):
        invalid = _validate_dockerhub_request(request)
        if invalid is not None:
            return invalid
        async with _dockerhub_requests:
            return await call_next(request)

    return await call_next(request)


@app.middleware("http")
async def enforce_pdf_document_boundary(request: Request, call_next):
    """Validate PDF document IDs before any router filesystem helper runs."""
    doc_id = pdf_doc_id_from_path(request.url.path)
    if doc_id is None:
        return await call_next(request)

    try:
        canonical_id = normalize_pdf_doc_id(doc_id)
    except (AttributeError, TypeError, ValueError):
        return JSONResponse(status_code=400, content={"detail": "Invalid document id"})

    # Server-generated document IDs are canonical lower-case UUIDs. Reject other
    # textual forms rather than letting equivalent UUID strings address different
    # filesystem paths.
    if canonical_id != doc_id:
        return JSONResponse(status_code=400, content={"detail": "Non-canonical document id"})

    # Deletion is destructive. Resolve the document before the route can touch
    # key/value or file state so a missing target is a normal 404 rather than a
    # blind best-effort rmtree against a caller-controlled path.
    if request.method == "DELETE" and request.url.path == f"/pdf/{canonical_id}":
        await pdf.ensure_doc_exists(get_state_store(), canonical_id)

    return await call_next(request)


@app.get("/live", include_in_schema=False)
async def live():
    """Process liveness: the ASGI event loop can still serve requests."""
    return {"ok": True}


@app.get("/ready", include_in_schema=False)
async def ready():
    """Readiness for the tool backend's local runtime dependencies."""
    failures: list[str] = []

    try:
        BACKEND_STATE_DIR.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=BACKEND_STATE_DIR, prefix=".ready-", delete=True):
            pass
    except OSError:
        failures.append("state_dir")

    if shutil.which("soffice") is None:
        failures.append("libreoffice")
    if shutil.which("gs") is None:
        failures.append("ghostscript")

    if failures:
        return JSONResponse(status_code=503, content={"ok": False, "failures": failures})
    return {"ok": True}


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:80",
        "http://127.0.0.1:80",
        "http://localhost",
        "http://127.0.0.1",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pdf.router)
app.include_router(convert.router)
app.include_router(dockerhub.router)
app.include_router(countryIndices.router)
