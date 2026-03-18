import logging

from fastapi import APIRouter, HTTPException, status

from models.job import JobDescriptionRequest, JobDescriptionResponse
from services.jd_parser import parse_job_description

router = APIRouter(prefix='/ai', tags=['AI - Job Description'])
logger = logging.getLogger(__name__)


@router.post('/parse-jd', response_model=JobDescriptionResponse)
def parse_job_description_route(payload: JobDescriptionRequest) -> JobDescriptionResponse:
  """Parse job descriptions into normalized skills, seniority, and embeddings."""
  try:
    return parse_job_description(payload)
  except HTTPException:
    raise
  except Exception as exc:  # noqa: BLE001
    logger.exception('parse-jd failed: %s', exc)
    raise HTTPException(
      status_code=status.HTTP_502_BAD_GATEWAY,
      detail={'error': 'jd_parse_failed', 'message': 'Job parsing failed. Please try again.'}
    ) from exc

