from report_generator.profiles import build_defensible_profile, run_defensible_profile


class DummyModel:
    def __init__(self):
        self.prompts = []

    def generate(self, prompt: str) -> str:
        self.prompts.append(prompt)
        if "Reviewer" in prompt or "reviewer" in prompt:
            return (
                "Checklist:\n- Checked citations\nRisk Flags:\n- Missing chart\nConfidence: 0.6"
            )
        return f"Response to: {prompt}"


def test_defensible_profile_skips_optional_review_by_default():
    model = DummyModel()
    profile = build_defensible_profile()

    results = profile.run(model, context={"section_name": "Executive Summary"})

    names = [result.name for result in results]
    assert "review" not in names
    assert len(model.prompts) == 4  # planning, retrieval, writing, verification


def test_defensible_profile_runs_review_when_enabled():
    model = DummyModel()
    results = run_defensible_profile(
        model, context={"section_name": "Executive Summary"}, enable_review=True
    )

    names = [result.name for result in results]
    assert names[-1] == "review"

    review_result = results[-1]
    assert review_result.parsed.checklist == ["Checked citations"]
    assert review_result.parsed.risk_flags == ["Missing chart"]
    assert review_result.parsed.confidence == 0.6
