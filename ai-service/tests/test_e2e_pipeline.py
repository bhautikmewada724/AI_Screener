from models.job import JobDescriptionRequest
from models.match import MatchRequest
from models.resume import ResumeParseRequest
from services.jd_parser import parse_job_description
from services.matching_service import score_match
from services.resume_parser import parse_resume

SAMPLE_RESUME_TEXT = """
Alex Rivera
Senior Backend Engineer specializing in Python, FastAPI, and PostgreSQL deployments on AWS.
Previously led microservice migrations and mentored engineers in DevOps best practices.
"""

SAMPLE_JOB_TEXT = """
Hiring a Senior Backend Engineer to own FastAPI services, PostgreSQL schemas, and AWS infrastructure.
Must be comfortable mentoring junior developers and working closely with product managers.
"""


def test_end_to_end_resume_to_match_flow(tmp_path):
  resume_request = ResumeParseRequest(
    file_path='',
    file_name='alex.pdf',
    user_id='user-999',
    resume_text=SAMPLE_RESUME_TEXT,
    candidate_name='Alex Rivera'
  )
  resume_result = parse_resume(resume_request)

  job_result = parse_job_description(
    JobDescriptionRequest(job_title='Senior Backend Engineer', job_description=SAMPLE_JOB_TEXT, location='Remote')
  )

  match_request = MatchRequest(
    resume_skills=resume_result.skills,
    job_required_skills=job_result.required_skills,
    resume_summary=resume_result.summary,
    job_summary=job_result.summary
  )

  match_response = score_match(match_request)

  assert match_response.match_score > 0.6
  assert 'FastAPI' in match_response.matched_skills
