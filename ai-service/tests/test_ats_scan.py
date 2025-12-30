from pathlib import Path

from pypdf import PdfWriter

from models.ats import ATSScanRequest
from services.ats_analyzer import ats_scan

SAMPLE_RESUME = """
Jane Doe
Senior Backend Engineer at FutureSoft (2019 - Present)
Led Python and FastAPI services deployed on AWS with Docker.
Skills: Python, FastAPI, AWS, Docker
"""

SAMPLE_JD = """
We are hiring a Senior Backend Engineer.
Must have: Python, FastAPI, PostgreSQL, AWS.
Nice to have: Redis, Kafka.
Responsibilities: Design APIs and mentor junior engineers.
"""


def test_ats_scan_returns_missing_skills_and_scores():
  payload = ATSScanRequest(
    job_id='job-1',
    resume_id='res-1',
    job_title='Senior Backend Engineer',
    job_description=SAMPLE_JD,
    file_path='',
    file_name='resume.pdf',
    user_id='user-1',
    resume_text=SAMPLE_RESUME,
    candidate_name='Jane Doe'
  )

  result = ats_scan(payload)

  assert result.overall.atsReadabilityScore >= 0
  assert result.overall.keywordMatchScore >= 0
  assert 'PostgreSQL' in result.skills.missingRequired
  assert any(m.keyword.lower() in {'postgresql', 'kafka', 'redis'} for m in result.keywordAnalysis.required.missing + result.keywordAnalysis.preferred.missing)


def test_ats_scan_flags_scanned_pdf(tmp_path: Path):
  pdf_path = tmp_path / 'blank.pdf'
  writer = PdfWriter()
  writer.add_blank_page(width=612, height=792)  # 8.5 x 11 inches
  with pdf_path.open('wb') as handle:
    writer.write(handle)

  payload = ATSScanRequest(
    job_id='job-2',
    resume_id='res-2',
    job_title='Data Analyst',
    job_description='Must have: SQL, Python',
    file_path=str(pdf_path),
    file_name='blank.pdf',
    user_id='user-2',
    resume_text=None,
    candidate_name='Alex'
  )

  result = ats_scan(payload)

  assert any(f.code == 'SCANNED_PDF' for f in result.formatFindings)


def test_evidence_gap_marks_weak_and_missing():
  resume_text = """
  Skills: Python, Flask
  Experience: Developed web services for reliability and uptime.
  """
  payload = ATSScanRequest(
    job_id='job-3',
    resume_id='res-3',
    job_title='Platform Engineer',
    job_description='Must have: Python, Kubernetes',
    file_path='',
    file_name='resume.pdf',
    user_id='user-3',
    resume_text=resume_text,
    candidate_name='Jordan'
  )

  result = ats_scan(payload)

  statuses = {gap.requirement: gap.status for gap in result.evidenceGaps}
  assert any(gap.status == 'weak' and 'Python' in gap.requirement for gap in result.evidenceGaps)
  assert any(gap.status == 'missing' and 'Kubernetes' in gap.requirement for gap in result.evidenceGaps)
