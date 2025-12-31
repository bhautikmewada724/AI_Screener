## Scoring Semantics (Week1-Day1 freeze)

- **ATS Readability**: Measures format/parseability only. It never contributes to the match score.
- **JD Keyword Coverage**: Presence-based alignment to JD terms (requirements/keywords observed).
- **JD Evidence Strength**: Proof-based alignment via experience/projects/achievements supporting the JD requirements.
- **JD_FIT_SCORE formula**: Σ(weight_i * satisfaction_i) / Σ(weight_i) * 100.
- **Satisfaction mapping**: `STRONG=1.0`, `WEAK=0.6`, `UNCERTAIN=0.4`, `MISSING=0.0`.
- **Naming**: UI label is `Match Score` (percent). Backend stores `matchScore` (0–1) today; convert to percent in UI by multiplying by 100.

### Why ATS and match can differ
- Evidence missing: JD requirements exist but evidence snippets/experience are absent, so JD Evidence Strength is low even if keywords appear.
- Requirements empty: JD has zero required skills/weights, so JD keyword coverage is empty and match score can fall back to defaults.
- Scaling mismatch: Match score stored as 0–1 while UI expects 0–100; ensure multiplication by 100 when rendering.

### Skill Ontology & Unknown Skills
- Skills are normalized via a data-driven ontology (`data/skill_ontology.json`) loaded at runtime (no redeploy for updates).
- Aliases are matched using universal canonicalization (punctuation stripping, `node js`→`nodejs`, `restful apis`→`rest api`, JWT/RBAC variants).
- Unrecognized phrases are recorded as unknown skills with counts and source (JD/Resume) only—no raw JD/resume text.
- Admin endpoints can list unknown skills and promote them into the ontology to make future runs recognize them automatically.

