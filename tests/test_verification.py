import sys
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.report_generator.models import Blueprint, Claim, EvidenceBundle, EvidenceItem, EvidencePolicy
from src.report_generator.verification import check_contradictions_and_redundancy, verify_section


class VerificationTestCase(unittest.TestCase):
    def setUp(self):
        self.bundle = EvidenceBundle(items={"ev1": EvidenceItem(id="ev1", source="vector", text="data point")})
        self.blueprint = Blueprint(assumptions=["service must be reliable"], forbidden=["do not mention outage"])
        self.claims = [Claim(text="Service must be reliable", evidence_ids=["ev1"])]

    def test_contradiction_detected(self):
        markdown = "Our service is not service must be reliable."
        issues = check_contradictions_and_redundancy(markdown, self.blueprint, prior_sections=[])
        self.assertTrue(any(issue.code == "CONTRADICTION" for issue in issues))

    def test_redundancy_against_prior_section(self):
        markdown = "Sentence one. Sentence two."
        prior = ["Sentence one. Different sentence."]
        issues = check_contradictions_and_redundancy(markdown, self.blueprint, prior_sections=prior)
        self.assertTrue(any(issue.code == "REDUNDANCY_PRIOR" for issue in issues))

    def test_verify_section_runs_all_checks(self):
        markdown = "# Summary\n- Service must be reliable [citation:ev1]"
        issues = verify_section(
            markdown=markdown,
            claims=self.claims,
            policy=EvidencePolicy.VECTOR_ONLY,
            evidence_bundle=self.bundle,
            blueprint=self.blueprint,
            prior_sections=[],
            formatting_requirements={"required_headings": ["Summary"], "min_words": 3},
        )
        self.assertEqual([], [i for i in issues if i.severity == "ERROR"])


if __name__ == "__main__":
    unittest.main()
