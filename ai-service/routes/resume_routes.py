import logging

from fastapi import APIRouter, HTTPException, status

from models.resume import ResumeParseRequest, ResumeParseResponse
from services.resume_parser import parse_resume

router = APIRouter(prefix='/ai', tags=['AI - Resume'])
logger = logging.getLogger(__name__)


@router.post('/parse-resume', response_model=ResumeParseResponse)
def parse_resume_route(payload: ResumeParseRequest) -> ResumeParseResponse:
  """Parse resumes into structured summaries, skills, experience, and embeddings."""
  try:
    return parse_resume(payload)
  except HTTPException:
    raise
  except Exception as exc:  # noqa: BLE001
    logger.exception('parse-resume failed: %s', exc)
    raise HTTPException(
      status_code=status.HTTP_502_BAD_GATEWAY,
      detail={'error': 'resume_parse_failed', 'message': 'Resume parsing failed. Please try again.'}
    ) from exc

