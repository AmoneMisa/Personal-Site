from __future__ import annotations

from typing import List

from pypdf import PdfReader, PdfWriter


def merge_pdfs(inputs: List[str], out_path: str) -> None:
    writer = PdfWriter()
    for path in inputs:
        reader = PdfReader(path)
        for page in reader.pages:
            writer.add_page(page)

    with open(out_path, "wb") as output:
        writer.write(output)
