from fastapi import APIRouter

from models.job import JobDescriptionRequest, JobDescriptionResponse
from services.jd_parser import parse_job_description

router = APIRouter(prefix='/ai', tags=['AI - Job Description'])


@router.post('/parse-jd', response_model=JobDescriptionResponse)
def parse_job_description_route(payload: JobDescriptionRequest) -> JobDescriptionResponse:
  """Parse job descriptions into normalized skills, seniority, and embeddings."""
  return parse_job_description(payload)

