from models.resume import ResumeParseRequest
from services.resume_parser import parse_resume

SAMPLE_RESUME = """
Jane Doe
Senior Backend Engineer at FutureSoft (2019 - Present)
Led Python and FastAPI services deployed on AWS with Docker and Kubernetes.
Previously Software Engineer at DataWorks (2016 - 2019) focusing on REST APIs and PostgreSQL.
Education
Massachusetts Institute of Technology, B.Sc. Computer Science, 2015
Skills: Python, FastAPI, AWS, Docker, PostgreSQL, Leadership, Communication
"""


def test_parse_resume_from_inline_text():
  payload = ResumeParseRequest(
    file_path='',
    file_name='jane.pdf',
    user_id='user-123',
    resume_text=SAMPLE_RESUME,
    candidate_name='Jane Doe'
  )

  result = parse_resume(payload)

  assert result.summary  # summary generated
  assert 'Python' in result.skills
  assert any(exp.company for exp in result.experience)
  assert result.embeddings and len(result.embeddings) > 0


def test_parse_resume_from_file(tmp_path):
  resume_file = tmp_path / 'resume.txt'
  resume_file.write_text(SAMPLE_RESUME, encoding='utf-8')

  payload = ResumeParseRequest(
    file_path=str(resume_file),
    file_name='resume.txt',
    user_id='user-456'
  )

  result = parse_resume(payload)

  assert result.summary != 'Unable to extract resume content.'
  assert 'fastapi' in {skill.lower() for skill in result.skills}
  assert result.education, 'education section should be detected'

