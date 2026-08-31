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


BACKEND_STATE_DIR = Path(os.getenv("BACKEND_STATE_DIR", "/var/app/state/backend"))


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
    # Redis/file state so a missing target is a normal 404 rather than a blind
    # best-effort rmtree against a caller-controlled path.
    if request.method == "DELETE" and request.url.path == f"/pdf/{canonical_id}":
        await pdf.ensure_doc_exists(canonical_id)

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
