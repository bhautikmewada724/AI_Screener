from fastapi import APIRouter

from models.job import JobDescriptionRequest, JobDescriptionResponse
from utils.mock_data import fake_embeddings

router = APIRouter(prefix='/ai', tags=['AI - Job Description'])


@router.post('/parse-jd', response_model=JobDescriptionResponse)
def parse_job_description(payload: JobDescriptionRequest) -> JobDescriptionResponse:
    """Return mocked job description insights."""
    base_skills = ['Communication', 'Leadership', 'Problem Solving']
    extra = ['Python', 'System Design'] if 'engineer' in payload.job_title.lower() else ['Recruiting']

    return JobDescriptionResponse(
        required_skills=base_skills + extra,
        summary=f"Mock summary for {payload.job_title} located in {payload.location or 'anywhere'}.",
        embeddings=fake_embeddings()
    )

