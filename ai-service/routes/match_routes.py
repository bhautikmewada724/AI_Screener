from fastapi import APIRouter

from models.match import MatchRequest, MatchResponse

router = APIRouter(prefix='/ai', tags=['AI - Matching'])


@router.post('/match', response_model=MatchResponse)
def match_resume_to_job(payload: MatchRequest) -> MatchResponse:
    """Return a deterministic mock match response so the contract is locked in."""
    overlap = set(payload.resume_skills).intersection(set(payload.job_required_skills))
    match_score = min(1.0, len(overlap) / (len(payload.job_required_skills) or 1))

    return MatchResponse(
        match_score=round(match_score or 0.75, 2),
        matched_skills=sorted(overlap) or ['Python'],
        notes='Mocked match score calculated from overlapping skills.'
    )

