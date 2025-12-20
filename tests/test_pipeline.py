import sys
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.report_generator.models import (  # noqa: E402
    Blueprint,
    Claim,
    EvidenceBundle,
    EvidenceItem,
    EvidencePolicy,
    SectionPlan,
)
from src.report_generator.pipeline import run_section_pipeline  # noqa: E402
from src.report_generator.verification import (
    check_citation_presence_and_format,
    check_evidence_policy_compliance,
)


class PipelineTestCase(unittest.TestCase):
    def setUp(self):
        self.evidence_bundle = EvidenceBundle(
            items={"ev1": EvidenceItem(id="ev1", source="vector", text="core fact")}
        )
        self.plan = SectionPlan(outline=["Key result", "Next step"], priority="P1")
        self.blueprint = Blueprint(
            assumptions=["customers need transparency"], forbidden=["prohibited claim"]
        )

    def test_vector_policy_requires_citations(self):
        claims = [Claim(text="A claim without evidence", evidence_ids=[])]
        issues = check_evidence_policy_compliance(claims, EvidencePolicy.VECTOR_ONLY, self.evidence_bundle)
        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0].code, "EVIDENCE_MISSING")

    def test_citation_format_detection(self):
        markdown = "Claim with malformed citation [citation:bad id]"
        claims = [Claim(text="claim", evidence_ids=["bad id"])]
        issues = check_citation_presence_and_format(markdown, claims, EvidencePolicy.WEB_ONLY)
        self.assertTrue(any(issue.code == "CITATION_FORMAT" for issue in issues))

    def test_pipeline_records_artifacts_and_repairs(self):
        artifacts, notes = run_section_pipeline(
            plan=self.plan,
            evidence_bundle=self.evidence_bundle,
            policy=EvidencePolicy.VECTOR_ONLY,
            blueprint=self.blueprint,
            prior_sections=["Previous section repeats."],
            formatting_requirements={"required_headings": ["Summary"], "min_words": 1},
        )

        artifact_types = [artifact.type for artifact in artifacts]
        self.assertIn("FINAL", [t.value for t in artifact_types])
        final_artifact = artifacts[-1]
        self.assertIn("claim_to_evidence", final_artifact.metadata)
        self.assertTrue(final_artifact.metadata["claim_to_evidence"])
        self.assertGreaterEqual(len(artifacts), 4)
        self.assertIsInstance(notes, list)


if __name__ == "__main__":
    unittest.main()
