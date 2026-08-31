from __future__ import annotations

import re
import uuid


# Every public PDF route that receives a document id. `/pdf/create` is
# intentionally excluded because it creates a new server-generated UUID.
_PDF_DOC_ROUTE_RE = re.compile(
    r"^/pdf/(?:"
    r"download|page-info|add-design-page|preview|background|text-blocks|image|"
    r"draft|save|download-result|assets"
    r")/(?P<nested>[^/]+)(?:/|$)|^/pdf/(?P<root>(?!create$)[^/]+)$"
)


def normalize_pdf_doc_id(value: str) -> str:
    """Return a canonical UUID string or raise ValueError for untrusted input."""
    parsed = uuid.UUID(str(value))
    return str(parsed)


def pdf_doc_id_from_path(path: str) -> str | None:
    """Extract a PDF document id from a known public PDF route, if present."""
    match = _PDF_DOC_ROUTE_RE.match(path)
    if not match:
        return None
    return match.group("nested") or match.group("root")


def is_valid_pdf_doc_id(value: str) -> bool:
    try:
        normalize_pdf_doc_id(value)
    except (AttributeError, TypeError, ValueError):
        return False
    return True
