from report_generator.adapters import ReviewerFeedback, parse_reviewer_response


def test_reviewer_adapter_extracts_structured_feedback():
    output = """
    Checklist:
    - Verified claims match citations.
    - Confirmed policy boundaries were respected.

    Risk Flags:
    - Evidence gaps for the competitive analysis subsection.
    - Ambiguous ownership of recommendations.

    Confidence: 0.82
    """

    feedback = parse_reviewer_response(output)

    assert feedback.checklist == [
        "Verified claims match citations.",
        "Confirmed policy boundaries were respected.",
    ]
    assert feedback.risk_flags == [
        "Evidence gaps for the competitive analysis subsection.",
        "Ambiguous ownership of recommendations.",
    ]
    assert feedback.confidence == 0.82


def test_reviewer_adapter_handles_missing_headers_and_clamps_confidence():
    feedback = parse_reviewer_response("Confidence: 1.7\n- Only one note")

    # Without an explicit checklist header, the full string is used.
    assert feedback.checklist == ["Confidence: 1.7\n- Only one note"]
    # Confidence is clamped to 1.0
    assert feedback.confidence == 1.0
