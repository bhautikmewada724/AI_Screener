from fastapi import APIRouter

from models.resume import ResumeParseRequest, ResumeParseResponse
from services.resume_parser import parse_resume

router = APIRouter(prefix='/ai', tags=['AI - Resume'])


@router.post('/parse-resume', response_model=ResumeParseResponse)
def parse_resume_route(payload: ResumeParseRequest) -> ResumeParseResponse:
  """Parse resumes into structured summaries, skills, experience, and embeddings."""
  return parse_resume(payload)

