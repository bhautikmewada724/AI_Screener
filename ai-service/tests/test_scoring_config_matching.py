from models.match import MatchRequest
from services.matching_service import score_match


def test_score_match_respects_scoring_config_weights():
  payload = MatchRequest(
    resume_skills=["python", "react"],
    job_required_skills=["python", "react", "node"],
    resume_summary="5 years experience. Location: Remote.",
    job_summary="Looking for 5 years experience. Location: Remote.",
    scoring_config_version=2,
  )

  result = score_match(payload)

  assert result.scoring_config_version == 2
  assert 0 <= result.match_score <= 1
  assert result.score_breakdown is not None
  assert "jdFitScore" in result.score_breakdown
  assert result.missing_must_have_skills is not None

