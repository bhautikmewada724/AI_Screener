from models.resume import ResumeParseRequest
from services.resume_parser import ResumeParser, parse_resume

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


def test_parse_resume_handles_llm_failure(monkeypatch):
  parser = ResumeParser()
  parser._use_llm = True  # force LLM path

  def _boom(*args, **kwargs):  # noqa: ANN001, D401
    raise RuntimeError('LLM offline')

  monkeypatch.setattr(ResumeParser, '_extract_structured_with_llm', _boom, raising=True)

  payload = ResumeParseRequest(
    file_path='',
    file_name='resume.pdf',
    user_id='user-789',
    resume_text=SAMPLE_RESUME
  )

  result = parser.parse(payload)

  assert result.skills, 'skills should still be extracted'
  assert result.warnings, 'warnings should mention fallback'


def test_experience_pipe_format_parsing():
  parser = ResumeParser()
  text = """
  Professional Experience
  Software Engineer | ABC Corp | Jan 2022 - Present
  - Built APIs
  """
  experience = parser._extract_experience(text)
  assert experience, 'experience should be parsed'
  assert experience[0].company == 'ABC Corp'
  assert 'Software Engineer' in experience[0].role
  assert experience[0].duration and 'Jan 2022' in experience[0].duration
  assert experience[0].startDate == '2022-01-01'


def test_education_section_without_keywords():
  parser = ResumeParser()
  text = """
  Education
  XYZ Academy
  Diploma in Data Science
  2019
  """
  sections = parser._split_sections(text)
  education = parser._extract_education(text, section_text=sections.get('education'))
  assert education, 'education should be parsed from section'
  assert education[0].institution == 'XYZ Academy'
  assert education[0].graduation_year == 2019


def test_parse_duration_mm_yyyy_range():
  parser = ResumeParser()
  start_date, end_date = parser._parse_duration('06/2021 - 11/2022')
  assert start_date == '2021-06-01'
  assert end_date == '2022-11-01'


def test_skills_dedupe_between_verified_and_unverified(monkeypatch):
  parser = ResumeParser()

  def _mock_extract_skills(_self, _text):  # noqa: ANN001
    return ['Python', 'AWS'], ['python', 'Communication']

  monkeypatch.setattr(ResumeParser, '_extract_skills', _mock_extract_skills, raising=True)

  payload = ResumeParseRequest(
    file_path='',
    file_name='resume.txt',
    user_id='user-999',
    resume_text='Skills: Python, AWS, Communication'
  )
  result = parser.parse(payload)
  assert 'python' not in {skill.lower() for skill in result.unverified_skills}

