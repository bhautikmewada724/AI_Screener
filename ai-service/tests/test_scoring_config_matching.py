from models.match import MatchRequest
from services.matching_service import score_match


def test_score_match_respects_scoring_config_weights():
  payload = MatchRequest(
    resume_skills=["python", "react"],
    job_required_skills=["python", "react", "node"],
    resume_summary="5 years experience. Location: Remote.",
    job_summary="Looking for 5 years experience. Location: Remote.",
    scoring_config={
      "weights": {
        "skills": 40,
        "experience": 40,
        "education": 10,
        "keywords": 10,
      },
      "constraints": {
        "mustHaveSkills": ["python"],
        "niceToHaveSkills": ["graphql"],
        "minYearsExperience": 3,
      },
    },
    scoring_config_version=2,
  )

  result = score_match(payload)

  assert result.scoring_config_version == 2
  assert 0 <= result.match_score <= 1
  assert result.score_breakdown is not None
  assert "skills_score" in result.score_breakdown
  assert "final_score" in result.score_breakdown
  assert result.missing_must_have_skills is not None


def test_invalid_weight_sum_returns_error():
  payload = MatchRequest(
    resume_skills=["python"],
    job_required_skills=["python"],
    scoring_config={
      "weights": {
        "skills": 10,
        "experience": 10,
        "education": 10,
        "keywords": 10,
      }
    }
  )

  try:
    score_match(payload)
    assert False, "Expected HTTPException for invalid weights"
  except Exception as exc:  # noqa: BLE001
    from fastapi import HTTPException
    assert isinstance(exc, HTTPException)
    assert exc.status_code == 400

