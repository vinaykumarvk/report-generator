from __future__ import annotations

from typing import Any, Dict, Iterable, List

from .adapters import parse_reviewer_response
from .pipeline import Profile, Stage
from .prompts import build_reviewer_prompt


def _constant_prompt(text: str):
    def _builder(_: Dict[str, Any]) -> str:
        return text

    return _builder


def build_defensible_profile() -> Profile:
    """
    Create the Defensible profile with an optional reviewer stage.

    The reviewer stage runs after verification and is disabled by default.
    """
    stages: List[Stage] = [
        Stage("planning", _constant_prompt("Plan the section.")),
        Stage("retrieval", _constant_prompt("Retrieve supporting evidence.")),
        Stage("writing", _constant_prompt("Draft the section content.")),
        Stage("verification", _constant_prompt("Verify against evidence.")),
        Stage(
            "review",
            build_reviewer_prompt,
            adapter=parse_reviewer_response,
            optional=True,
        ),
    ]
    return Profile(name="defensible", stages=stages)


def run_defensible_profile(
    model,
    context: Dict[str, Any] | None = None,
    enable_review: bool = False,
) -> List:
    """
    Execute the Defensible profile with optional reviewer stage.

    Args:
        model: A model client exposing ``generate``.
        context: Mutable pipeline context.
        enable_review: If True, run the optional review stage.
    """
    profile = build_defensible_profile()
    enabled = {"review"} if enable_review else set()
    return profile.run(model, context=context, enabled_optional=enabled)
