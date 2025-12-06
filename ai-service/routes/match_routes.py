from fastapi import APIRouter

from models.match import MatchRequest, MatchResponse
from services.matching_service import score_match

router = APIRouter(prefix='/ai', tags=['AI - Matching'])


@router.post('/match', response_model=MatchResponse)
def match_resume_to_job(payload: MatchRequest) -> MatchResponse:
  """Return a scored match that blends skills and embeddings."""
  return score_match(payload)

