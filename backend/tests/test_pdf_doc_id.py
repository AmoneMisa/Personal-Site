import unittest
from pathlib import Path

from src.utils.pdf_doc_id import (
    is_valid_pdf_doc_id,
    normalize_pdf_doc_id,
    pdf_doc_id_from_path,
    require_canonical_pdf_doc_id,
)


VALID_ID = "123e4567-e89b-12d3-a456-426614174000"


class PdfDocumentIdTests(unittest.TestCase):
    def test_normalizes_valid_uuid(self):
        self.assertEqual(normalize_pdf_doc_id(VALID_ID.upper()), VALID_ID)

    def test_requires_canonical_uuid_for_internal_storage_boundary(self):
        self.assertEqual(require_canonical_pdf_doc_id(VALID_ID), VALID_ID)
        for value in (VALID_ID.upper(), "../", "../../tmp", "not-a-uuid", "", "%2e%2e"):
            with self.subTest(value=value):
                with self.assertRaises((TypeError, ValueError)):
                    require_canonical_pdf_doc_id(value)

    def test_rejects_path_traversal_and_non_uuid_values(self):
        for value in ("../", "../../tmp", "not-a-uuid", "", "%2e%2e"):
            with self.subTest(value=value):
                self.assertFalse(is_valid_pdf_doc_id(value))

    def test_extracts_document_id_from_nested_pdf_routes(self):
        paths = (
            f"/pdf/download/{VALID_ID}",
            f"/pdf/preview/{VALID_ID}/1",
            f"/pdf/image/{VALID_ID}/image.png",
            f"/pdf/assets/{VALID_ID}/asset-id",
        )
        for path in paths:
            with self.subTest(path=path):
                self.assertEqual(pdf_doc_id_from_path(path), VALID_ID)

    def test_extracts_document_id_from_delete_route(self):
        self.assertEqual(pdf_doc_id_from_path(f"/pdf/{VALID_ID}"), VALID_ID)

    def test_does_not_treat_create_as_document_id(self):
        self.assertIsNone(pdf_doc_id_from_path("/pdf/create"))

    def test_delete_preflight_resolves_document_through_state_store(self):
        main_source = Path(__file__).parents[1].joinpath("src/main.py").read_text(encoding="utf-8")
        self.assertIn("await pdf.ensure_doc_exists(get_state_store(), canonical_id)", main_source)

    def test_filesystem_helpers_revalidate_document_id_internally(self):
        pdf_source = Path(__file__).parents[1].joinpath("src/routers/pdf.py").read_text(encoding="utf-8")
        self.assertIn("canonical_doc_id = require_canonical_pdf_doc_id(doc_id)", pdf_source)
        self.assertIn("return os.path.join(STORAGE_ROOT, canonical_doc_id)", pdf_source)
        self.assertNotIn("return os.path.join(STORAGE_ROOT, doc_id)", pdf_source)


if __name__ == "__main__":
    unittest.main()
