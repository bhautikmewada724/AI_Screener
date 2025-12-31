import hashlib
import logging
import os
import uuid

from fastapi import APIRouter, Body, HTTPException, status

from models.ats import ATSScanRequest, ATSScanResponse
from services.ats_analyzer import ats_scan

router = APIRouter(prefix='/ai', tags=['AI - ATS'])
logger = logging.getLogger(__name__)
_MAX_TEXT_LEN = 20000


@router.post(
  '/ats-scan',
  response_model=ATSScanResponse,
  summary='ATS scan: analyze JD + resume for ATS readiness',
  response_description='ATS-friendly feedback, keyword coverage, and format findings.'
)
def ats_scan_route(
  payload: ATSScanRequest = Body(
    ...,
    example={
      'job_id': 'job-123',
      'resume_id': 'resume-456',
      'job_title': 'Backend Engineer',
      'job_description': 'Must: Python, FastAPI, PostgreSQL. Preferred: Kafka, Docker, AWS.',
      'file_path': None,
      'file_name': 'resume.pdf',
      'user_id': 'candidate-1',
      'resume_text': 'Skills: Python, FastAPI, Docker\nExperience: Built REST APIs using FastAPI',
      'candidate_name': 'Jane Doe'
    }
  )
) -> ATSScanResponse:
  """Scan a resume against a job description and return ATS-style feedback."""
  _validate_payload(payload)

  request_id = uuid.uuid4().hex[:12]
  resume_len = len(payload.resume_text or '') if payload.resume_text is not None else 0
  jd_len = len(payload.job_description or '')
  resume_hash = hashlib.sha256((payload.resume_text or '').encode('utf-8')).hexdigest()[:10] if payload.resume_text else ''

  logger.info(
    'ats_scan_request',
    extra={
      'event': 'ats_scan_request',
      'request_id': request_id,
      'job_id': payload.job_id,
      'resume_id': payload.resume_id,
      'resume_hash': resume_hash,
      'resume_len': resume_len,
      'jd_len': jd_len
    }
  )

  try:
    return ats_scan(payload)
  except HTTPException:
    raise
  except Exception as exc:  # noqa: BLE001
    logger.exception('ats-scan failed: %s', exc)
    raise HTTPException(
      status_code=status.HTTP_502_BAD_GATEWAY,
      detail={'error': 'ats_scan_failed', 'message': 'ATS scan failed. Please try again.'}
    ) from exc


def _validate_payload(payload: ATSScanRequest) -> None:
  if payload.resume_text and len(payload.resume_text) > _MAX_TEXT_LEN:
    raise HTTPException(
      status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
      detail={'error': 'resume_text_too_large', 'message': 'Resume text too large.'}
    )
  if payload.job_description and len(payload.job_description) > _MAX_TEXT_LEN:
    raise HTTPException(
      status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
      detail={'error': 'job_description_too_large', 'message': 'Job description too large.'}
    )

  if payload.file_path:
    norm = os.path.normpath(payload.file_path)
    if '..' in norm.split(os.sep):
      raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={'error': 'invalid_file_path', 'message': 'Unsafe file path.'}
      )
    if len(payload.file_path) > 500:
      raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={'error': 'invalid_file_path', 'message': 'File path too long.'}
      )
    if not os.path.exists(payload.file_path):
      raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={'error': 'file_not_found', 'message': 'Resume file not found.'}
      )
