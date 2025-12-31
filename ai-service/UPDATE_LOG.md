## Update Log

- `services/ats_analyzer.py`: Added structured logging, stronger format inspection (multi-column, nonstandard headings), and enhanced scoring logic.
- `routes/ats_routes.py`: Added request validation, structured logging, and OpenAPI example/summary for `POST /ai/ats-scan`.
- `tests/test_ats_scan.py`: Expanded ATS scan coverage with scanned-PDF detection and evidence gap heuristics.
- `models/rse.py`, `services/rse_engine.py`: Introduced JDRequirement + RequirementResult models, builder/evaluator, and JD_FIT_SCORE calculation.
- `services/matching_service.py`: Replaced heuristic matching with RSE-based JD_FIT_SCORE (single source of truth for match scoring).
- `services/ats_analyzer.py`, `models/ats.py`: ATS scan now reuses RSE results, surfaces requirement breakdown, and exposes JD fit score/evidence strength.
- `tests/test_matching_service.py`, `tests/test_scoring_config_matching.py`, `tests/test_ats_scan.py`: Updated to validate RSE scoring, requirement explainability, and ATS integration.

