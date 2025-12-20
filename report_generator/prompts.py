from __future__ import annotations

from typing import Any, Dict, List


def build_reviewer_prompt(context: Dict[str, Any]) -> str:
    """
    Compose a prompt for a skeptical reviewer to validate a section.

    The prompt asks the model to deliver three artifacts:
    * Checklist of what was validated.
    * Risk flags describing gaps or concerns.
    * Confidence score between 0 and 1.
    """
    section = context.get("section_name", "the section")
    verification_summary = context.get("verification_parsed") or context.get(
        "verification_raw"
    )
    constraints: List[str] = []

    if verification_summary:
        constraints.append(
            "Ground your feedback on the verification summary rather than re-doing verification."
        )
    constraints.append(
        "Do not introduce new facts; stay within provided content and assumptions."
    )
    constraints.append("Return explicit coverage and risk observations.")

    instruction_block = "\n".join(f"- {item}" for item in constraints)

    return (
        "You are an exacting reviewer performing a defensibility check.\n"
        f"Section: {section}\n"
        f"Verification summary: {verification_summary or 'not provided'}\n\n"
        "Produce:\n"
        "1) Checklist: 3-7 bullets with what you reviewed and why it matters.\n"
        "2) Risk Flags: bullets for missing evidence, policy violations, or weak claims.\n"
        "3) Confidence: value between 0 and 1 (0=none, 1=high) reflecting defensibility.\n\n"
        "Format:\n"
        "Checklist:\n"
        "- item\n"
        "Risk Flags:\n"
        "- risk\n"
        "Confidence: 0.78\n\n"
        "Guardrails:\n"
        f"{instruction_block}\n"
        "Only respond with the formatted checklist, risk flags, and confidence."
    )
