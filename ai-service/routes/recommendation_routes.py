from fastapi import APIRouter

from models.recommendation import JobListing, RecommendationRequest, RecommendationResponse
from utils.mock_data import timestamp

router = APIRouter(prefix='/ai', tags=['AI - Recommendations'])


@router.post('/recommend', response_model=RecommendationResponse)
def recommend_jobs(payload: RecommendationRequest) -> RecommendationResponse:
    """Return deterministic ranked job recommendations."""
    base_jobs = [
        JobListing(job_id='job-001', title='Backend Engineer', score=0.91),
        JobListing(job_id='job-002', title='AI Specialist', score=0.87),
        JobListing(job_id='job-003', title='Technical Recruiter', score=0.74)
    ]

    return RecommendationResponse(
        ranked_jobs=base_jobs,
        generated_at=timestamp()
    )

