from __future__ import annotations

from io import BytesIO
from urllib.parse import urlparse

import pytest
from docx import Document
from moto import mock_aws
from PyPDF2 import PdfReader

from app.export.docx import DocxExporter
from app.export.pdf import PdfExporter
from app.storage.s3 import S3Storage


BUCKET = "reports"


@pytest.fixture(scope="session", autouse=True)
def moto_mock() -> None:
    with mock_aws():
        yield


@pytest.fixture()
def storage() -> S3Storage:
    return S3Storage(
        bucket=BUCKET,
        endpoint_url="https://s3.amazonaws.com",
        access_key="testing",
        secret_key="testing",
    )


def test_docx_conversion_and_upload(storage: S3Storage) -> None:
    exporter = DocxExporter()
    docx_bytes = exporter.render("# Sample Report\n\nThis is a test document.")

    key = storage.build_object_key("exports/docx", "sample.docx")
    stored_key = storage.upload_bytes(
        key,
        docx_bytes,
        content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        metadata={"origin": "integration-test", "format": "docx"},
    )

    assert stored_key.startswith("exports/docx/")

    metadata = storage.object_metadata(stored_key)
    assert metadata["content_type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    assert metadata["metadata"]["origin"] == "integration-test"

    response = storage.client.get_object(Bucket=BUCKET, Key=stored_key)
    downloaded = response["Body"].read()
    document = Document(BytesIO(downloaded))
    paragraph_texts = [p.text for p in document.paragraphs]
    assert any("This is a test document." in text for text in paragraph_texts)

    presigned = storage.generate_presigned_url(stored_key, expires_in=300)
    parsed = urlparse(presigned)
    assert parsed.path.endswith(f"/{BUCKET}/{stored_key}")
    assert "X-Amz-Signature" in parsed.query


def test_pdf_conversion_and_upload(storage: S3Storage) -> None:
    exporter = PdfExporter(from_markdown=False)
    pdf_bytes = exporter.render("<h1>PDF Title</h1><p>Body text with evidence.</p>")

    key = storage.build_object_key("exports/pdf", "sample.pdf")
    storage.upload_bytes(
        key,
        pdf_bytes,
        content_type="application/pdf",
        metadata={"origin": "integration-test", "format": "pdf"},
    )

    response = storage.client.get_object(Bucket=BUCKET, Key=key)
    downloaded = response["Body"].read()

    reader = PdfReader(BytesIO(downloaded))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    assert "PDF Title" in text
    assert "Body text with evidence." in text
