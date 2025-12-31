from models.rse import JDRequirement
from services.rse_engine import evaluate_requirements
from services.skill_utils import normalize_skill_list


def test_backend_dev_jd_variants_score_well():
  # JD requirements
  jd_skills = [
    'Node.js',
    'Express',
    'MongoDB',
    'Mongoose',
    'JWT',
    'RBAC',
    'Validation',
    'REST APIs'
  ]
  normalized = normalize_skill_list(jd_skills)
  requirements = [
    JDRequirement(
      id=f'req-{i}',
      type='skill',
      rawText=skill,
      normalizedTerms=[normalized[i]],
      weight=1.0,
      isRequired=True,
      explicitlyStated=True,
      evidenceRule='Mentioned in experience or projects'
    )
    for i, skill in enumerate(jd_skills)
  ]

  resume_text = """
  Backend engineer working with node js and expressjs.
  Built RESTful APIs with JSON Web Tokens for auth and role-based access control (RBAC).
  Integrated mongodb using mongoose drivers, performed request validation.
  """
  results = evaluate_requirements(requirements, resume_text)

  status_map = {res.requirementText: res.status for res in results}
  assert status_map['Mongoose'] in ('WEAK', 'UNCERTAIN', 'STRONG')
  assert status_map['Node.js'] != 'MISSING'
  assert status_map['Express'] != 'MISSING'
  assert status_map['MongoDB'] != 'MISSING'
  assert status_map['JWT'] != 'MISSING'
  assert status_map['RBAC'] != 'MISSING'
  assert status_map['Validation'] != 'MISSING'
  assert status_map['REST APIs'] != 'MISSING'

  # No requirement marked missing should have evidence snippets containing term
  for res in results:
    if res.status == 'MISSING':
      combined = ' '.join(res.evidenceSnippets or []).lower()
      for term in res.normalizedTerms:
        assert term not in combined

