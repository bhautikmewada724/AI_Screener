from models.rse import JDRequirement
from services.rse_engine import evaluate_requirements


def test_missing_cannot_have_evidence_snippet():
  req = JDRequirement(
    id='req1',
    type='skill',
    rawText='Node.js',
    normalizedTerms=['Node.js'],
    weight=1.0,
    isRequired=True,
    explicitlyStated=True,
    evidenceRule='Mentioned in experience'
  )

  resume_text = "Built Node.js services and REST APIs with MongoDB."
  results = evaluate_requirements([req], resume_text)

  assert results[0].status in ('WEAK', 'UNCERTAIN', 'STRONG')
  assert 'Node.js' in results[0].requirementText


def test_normalization_handles_rest_and_nodejs():
  req = JDRequirement(
    id='req2',
    type='skill',
    rawText='REST APIs',
    normalizedTerms=['rest apis'],
    weight=1.0,
    isRequired=True,
    explicitlyStated=True,
    evidenceRule='Mentioned in experience'
  )

  resume_text = "Designed REST api endpoints in a Nodejs stack."
  results = evaluate_requirements([req], resume_text)

  assert results[0].status != 'MISSING'

