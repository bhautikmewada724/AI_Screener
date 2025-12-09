from models.recommendation import CandidateProfile, JobRecommendationInput, RecommendationRequest
from services.recommendation_service import recommend_jobs


def test_recommend_jobs_prioritizes_overlap_and_similarity():
  payload = RecommendationRequest(
    candidate=CandidateProfile(
      id='cand-1',
      skills=['React', 'Node.js', 'TypeScript'],
      embeddings=[0.9, 0.1, 0.1],
      preferred_locations=['remote']
    ),
    jobs=[
      JobRecommendationInput(
        job_id='job-strong',
        title='Fullstack Engineer',
        required_skills=['React', 'Node.js', 'TypeScript'],
        embeddings=[0.88, 0.12, 0.08],
        location='remote'
      ),
      JobRecommendationInput(
        job_id='job-weak',
        title='Backend Engineer',
        required_skills=['Node.js'],
        embeddings=[-0.5, -0.4, -0.1],
        location='remote'
      )
    ]
  )

  response = recommend_jobs(payload)

  assert response.ranked_jobs, 'should recommend at least one job'
  assert response.ranked_jobs[0].job_id == 'job-strong'
  assert response.ranked_jobs[0].score > response.ranked_jobs[-1].score


def test_recommend_jobs_returns_empty_for_no_jobs():
  payload = RecommendationRequest(
    candidate=CandidateProfile(skills=['Python']),
    jobs=[]
  )

  response = recommend_jobs(payload)

  assert response.ranked_jobs == []


def test_embedding_similarity_and_nice_to_have_skills_influence_score():
  payload = RecommendationRequest(
    candidate=CandidateProfile(
      id='cand-2',
      skills=['Python', 'Django', 'APIs'],
      embeddings=[0.2, 0.8, 0.4]
    ),
    jobs=[
      JobRecommendationInput(
        job_id='job-embedding-strong',
        title='Backend Engineer',
        required_skills=['Python'],
        nice_to_have_skills=['Django'],
        embeddings=[0.25, 0.78, 0.39],
        location='remote'
      ),
      JobRecommendationInput(
        job_id='job-embedding-weak',
        title='Backend Engineer',
        required_skills=['Python'],
        embeddings=[-0.7, -0.6, -0.6],
        location='remote'
      )
    ]
  )

  response = recommend_jobs(payload)

  assert len(response.ranked_jobs) == 2
  strong, weak = response.ranked_jobs[0], response.ranked_jobs[1]
  assert strong.job_id == 'job-embedding-strong'
  assert strong.score > weak.score

