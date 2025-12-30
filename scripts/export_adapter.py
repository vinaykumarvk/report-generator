from __future__ import annotations

import json
import sys
from pathlib import Path

from app.export.docx import DocxExporter
from app.export.pdf import PdfExporter


def main() -> None:
    payload = json.load(sys.stdin)
    mode = payload.get("mode")
    content = payload.get("content") or ""
    output_path = payload.get("output_path")

    if not output_path:
        print(json.dumps({"error": "output_path is required"}))
        return

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    if mode == "docx":
        exporter = DocxExporter()
        data = exporter.render(content, from_markdown=True)
        output.write_bytes(data)
        print(json.dumps({"ok": True}))
        return

    if mode == "pdf":
        exporter = PdfExporter(from_markdown=True)
        data = exporter.render(content)
        output.write_bytes(data)
        print(json.dumps({"ok": True}))
        return

    print(json.dumps({"error": "mode must be docx or pdf"}))


if __name__ == "__main__":
    main()
