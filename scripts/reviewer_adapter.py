from __future__ import annotations

import json
import sys

from report_generator.adapters import parse_reviewer_response
from report_generator.prompts import build_reviewer_prompt


def main() -> None:
    payload = json.load(sys.stdin)
    mode = payload.get("mode")

    if mode == "prompt":
        context = payload.get("context") or {}
        prompt = build_reviewer_prompt(context)
        print(json.dumps({"prompt": prompt}))
        return

    if mode == "parse":
        output = payload.get("output") or ""
        feedback = parse_reviewer_response(output)
        print(
            json.dumps(
                {
                    "checklist": feedback.checklist,
                    "risk_flags": feedback.risk_flags,
                    "confidence": feedback.confidence,
                }
            )
        )
        return

    print(json.dumps({"error": "mode must be prompt or parse"}))


if __name__ == "__main__":
    main()
