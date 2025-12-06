from models.job import JobDescriptionRequest
from services.jd_parser import parse_job_description

SAMPLE_JD = """
We are hiring a Senior Backend Engineer to build resilient APIs and microservices.
Must have: Python, FastAPI, PostgreSQL, AWS, Docker, Kubernetes.
Nice to have: GraphQL experience, Redis, and exposure to Kafka.
Responsibilities include designing scalable architectures, mentoring junior engineers,
and collaborating with product to define roadmaps.
This role sits with our platform engineering group.
"""


def test_parse_job_description_required_and_preferred_skills():
  payload = JobDescriptionRequest(
    job_title='Senior Backend Engineer',
    job_description=SAMPLE_JD,
    location='Remote'
  )

  result = parse_job_description(payload)

  assert 'Python' in result.required_skills
  assert 'GraphQL' in result.nice_to_have_skills
  assert result.seniority_level == 'senior'
  assert result.job_category == 'backend'
  assert result.embeddings and len(result.embeddings) > 0

