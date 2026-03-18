## Update Log

- `src/services/aiService.js`: Added ATS scan client with timeout/retry controls and configurable AI service timeout settings.
- `src/controllers/atsScanController.js`: New controller to fetch job + resume, call ai-service `/ai/ats-scan`, and map errors safely with structured logging metadata.
- `src/routes/atsRoutes.js`: Exposes `POST /api/jobs/:jobId/ats-scan` for candidates.
- `src/app.js`: Registers ATS scan route.
- `src/controllers/__tests__/atsScanController.test.js`: Tests ATS scan controller success, missing resources, and timeout handling.

- Skill ontology + unknown skill queue:
  - `data/skill_ontology.json`: Seed ontology file for canonical skills.
  - `src/utils/skillCanonicalizer.js`: Universal canonicalization for tech terms.
  - `src/models/UnknownSkill.js`: Mongo model for unknown skill phrases with counts/sources.
  - `src/services/skillOntologyService.js`: Load ontology, normalize phrases, record unknowns, promote new skills.
  - `src/controllers/skillOntologyAdminController.js` & `src/routes/adminRoutes.js`: Admin endpoints for listing ontology, unknown skills, normalization, and promotion (admin-only).
  - `src/services/hrWorkflowService.js`: Normalizes JD and resume skills through ontology before scoring.
  - `src/services/__tests__/skillOntologyService.test.js`: Tests for ontology loading, unknown capture, and promotion.
  - `docs/scoring.md`: Added Skill Ontology & Unknown Skills section.
- Week1-Day1 audit mode + diagnostics:
  - `docs/scoring.md`: Freeze score semantics (ATS readability, JD keyword coverage, evidence strength, JD_FIT_SCORE, satisfaction mapping, mismatch reasons).
  - `src/utils/audit.js`: Shared audit helpers for flag gating, hashing, and safe snippets.
  - `src/controllers/atsScanController.js`: Add audit-mode logging, hash-based resume identity, resume source tagging, and optional audit payload in responses.
  - `src/controllers/applicationController.js`: Add audit logging around match score persistence and optional audit payload in apply responses.
  - `src/controllers/auditDevController.js` & `src/routes/devAuditRoutes.js`: Dev-only mismatch checklist endpoint behind ENABLE_AUDIT_MODE + candidate auth.
  - `src/app.js`: Register dev audit route.
  - `src/controllers/__tests__/atsScanController.test.js`, `src/controllers/__tests__/applicationController.test.js`, `src/controllers/__tests__/auditDevController.test.js`: Cover audit payload gating, sanitized logs, and mismatch checklist responses.

