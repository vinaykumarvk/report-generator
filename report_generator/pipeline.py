from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Iterable, List, Sequence


PromptBuilder = Callable[[Dict[str, Any]], str]
Adapter = Callable[[str], Any]


@dataclass
class StageResult:
    """Captures the outcome of a single pipeline stage."""

    name: str
    prompt: str
    raw_output: str
    parsed: Any


@dataclass
class Stage:
    """Represents an executable stage in a profile."""

    name: str
    prompt_builder: PromptBuilder
    adapter: Adapter = lambda output: output  # type: ignore[assignment]
    optional: bool = False

    def run(self, model: "ModelClient", context: Dict[str, Any]) -> StageResult:
        """Execute the stage using the provided model and context."""
        prompt = self.prompt_builder(context)
        raw_output = model.generate(prompt)
        parsed = self.adapter(raw_output)
        return StageResult(
            name=self.name,
            prompt=prompt,
            raw_output=raw_output,
            parsed=parsed,
        )


@dataclass
class Profile:
    """Pipeline profile that groups ordered stages."""

    name: str
    stages: List[Stage] = field(default_factory=list)

    def add_stage(self, stage: Stage) -> None:
        self.stages.append(stage)

    def run(
        self,
        model: "ModelClient",
        context: Dict[str, Any] | None = None,
        enabled_optional: Iterable[str] | None = None,
    ) -> List[StageResult]:
        """
        Run the profile against the provided model.

        Args:
            model: An object exposing a ``generate(prompt: str) -> str`` method.
            context: Mutable context passed to prompt builders.
            enabled_optional: Names of optional stages to execute.
        """
        run_optional = set(enabled_optional or [])
        ctx = dict(context or {})
        results: List[StageResult] = []
        for stage in self.stages:
            if stage.optional and stage.name not in run_optional:
                continue

            result = stage.run(model, ctx)
            results.append(result)

            # Surface both parsed and raw outputs for downstream prompt builders.
            ctx[f"{stage.name}_raw"] = result.raw_output
            ctx[f"{stage.name}_parsed"] = result.parsed

        return results


class ModelClient:
    """
    Minimal protocol for a model client used by tests.

    This avoids forcing a specific LLM provider dependency while enabling
    profile execution to remain strongly typed.
    """

    def generate(self, prompt: str) -> str:  # pragma: no cover - interface only
        raise NotImplementedError
