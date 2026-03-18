from models.match import MatchRequest
from services.matching_service import score_match


def test_match_score_positive_with_resume_text():
  payload = MatchRequest(
    resume_skills=['Node.js', 'MongoDB'],
    job_required_skills=['Node.js', 'MongoDB', 'Express'],
    resume_text='Node.js developer building REST APIs with MongoDB',
    job_summary='Looking for Node.js developer with MongoDB experience',
    include_trace=False,
    scoring_config={'constraints': {}, 'weights': {'skills': 50, 'experience': 50}},
    scoring_config_version=1
  )

  result = score_match(payload)

  assert result.match_score > 0
  assert result.score_breakdown['jdFitScore'] > 0


def test_rust_matches_without_ontology(monkeypatch, tmp_path):
  ontology_path = tmp_path / 'ontology.json'
  ontology_path.write_text('[]')
  monkeypatch.setenv('SKILL_ONTOLOGY_PATH', str(ontology_path))

  payload = MatchRequest(
    resume_skills=['Rust'],
    job_required_skills=['Rust'],
    resume_text='Rust systems engineer',
    job_summary='Rust developer',
    include_trace=False
  )

  result = score_match(payload)
  assert result.match_score > 0

