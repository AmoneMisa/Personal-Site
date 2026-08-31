import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .routers import pdf, convert, dockerhub, countryIndices
from .routers.pdf import pdf_storage_cleanup_loop
from .utils.pdf_doc_id import is_valid_pdf_doc_id, pdf_doc_id_from_path


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
async def reject_invalid_pdf_document_ids(request: Request, call_next):
    """Block untrusted PDF document IDs before any router filesystem helper runs."""
    doc_id = pdf_doc_id_from_path(request.url.path)
    if doc_id is not None and not is_valid_pdf_doc_id(doc_id):
        return JSONResponse(status_code=400, content={"detail": "Invalid document id"})
    return await call_next(request)


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
