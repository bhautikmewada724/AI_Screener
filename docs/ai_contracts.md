# AI Service Contracts (Current State – Phase 7 Baseline)

This document freezes the request/response schemas that the Node backend and React frontend rely on when communicating with the FastAPI `ai-service`. All changes during the upgrade must remain backward-compatible with the fields marked **Required** below. Fields listed as **Extensible** can be enriched as long as their existing semantics stay intact.

---

## `POST /ai/parse-resume`
**Used by:** `backend/src/controllers/resumeController.js` → stored in `Resume.parsedData`, rendered via `frontend/src/types/api.ts (ResumePayload)`

### Request (`ResumeParseRequest`)
| Field | Type | Required | Notes / Consumers |
| --- | --- | --- | --- |
| `file_path` | `string` | ✅ | Absolute path stored by Multer; backend always sends this (AI must be able to open it). |
| `file_name` | `string` | ✅ | Original filename (used only for logging/UI today). |
| `user_id` | `string` | ✅ | Candidate Mongo `_id`; persisted for traceability. |
| `resume_text` | `string \| null` | ⚪ | Optional fallback text if direct file parsing fails. |
| `candidate_name` | `string \| null` | ⚪ | Optional metadata, currently unused but keep compatible. |

### Response (`ResumeParseResponse`)
| Field | Type | Required | Notes / Consumers |
| --- | --- | --- | --- |
| `summary` | `string` | ✅ | Displayed in HR UI (`ResumeViewer`) and stored in Mongo. |
| `skills` | `string[]` | ✅ | Must be a flat array; drives matching + UI chips. |
| `experience` | `Array<{ company: string; role: string; duration?: string; startDate?: string; endDate?: string }>` | ✅ | Backend maps `duration` into the `description` field and keeps ISO dates when available for analytics. |
| `education` | `Array<{ institution: string; degree?: string; graduation_year?: number }>` | ✅ | `graduation_year` is normalized to `education[].year` before persisting. |
| `location` | `string` | ⚪ | Surface-level location inference stored in `Resume.parsedData.location`. |
| `embeddings` | `number[]` | ✅ (contract) | Stored in `Resume.parsedData.embeddings`; not yet surfaced on frontend but backend expects the field to exist (can be empty array). |
| `warnings` | `string[]` | ⚪ | Non-fatal parsing issues; stored with the resume so HR can review. |
| `error` / `warnings` | (not present today) | Extensible | New diagnostic fields may be added but cannot replace core fields above. |

> _Backend note:_ `transformAiResumeToParsedData` now guarantees camelCase fields (`education.year`, `parsedData.location`, etc.) so the frontend no longer sees raw snake_case data.

---

## `POST /ai/parse-jd`
**Current usage:** not yet wired into controllers, but the schema should remain backward-compatible for upcoming automation inside `jobController`.

### Request (`JobDescriptionRequest`)
| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `job_title` | `string` | ✅ | Human-readable title entered in UI. |
| `job_description` | `string` | ✅ | Raw JD text body. |
| `location` | `string \| null` | ⚪ | Optional metadata; backend forwards if present. |

### Response (`JobDescriptionResponse`)
| Field | Type | Required | Notes / Consumers |
| --- | --- | --- | --- |
| `required_skills` | `string[]` | ✅ | Populates `JobDescription.requiredSkills` when HR has not provided their own list. |
| `summary` | `string` | ✅ | Persisted in `JobDescription.metadata.aiSummary` for future UI previews. |
| `embeddings` | `number[]` | ✅ (can be empty) | Will be saved in `JobDescription.embeddings` for semantic search/matching. |
| `nice_to_have_skills` | `string[]` | ⚪ | Stored in `JobDescription.niceToHaveSkills`. |
| `seniority_level`, `job_category` | ⚪ | Persisted in `JobDescription.metadata.seniorityLevel` / `.jobCategory`. |
| `warnings` | `string[]` | ⚪ | Passed through for HR visibility. |

> _Backend note:_ `transformAiJdToJobFields` merges AI metadata with any user-provided fields and only overwrites `requiredSkills`/`niceToHaveSkills` when the request leaves them empty.

---

## `POST /ai/match`
**Used by:** `jobController.getJobMatches`, `hrWorkflowService.ensureMatchResult`, `applicationController.applyToJob`, HR score previews. Results are persisted in `MatchResult` and exposed to frontend types (`matchScore`, `matchedSkills`, `matchExplanation`).

### Request (`MatchRequest`)
| Field | Type | Required | Notes / Consumers |
| --- | --- | --- | --- |
| `resume_skills` | `string[]` | ✅ | Derived from `Resume.parsedData.skills`. |
| `job_required_skills` | `string[]` | ✅ | Pulled from `JobDescription.requiredSkills`. |
| `resume_summary` | `string \| null` | ⚪ | Provides additional context for LLM scoring. |
| `job_summary` | `string \| null` | ⚪ | Usually the raw JD description today. |
| `include_trace` | `boolean` | ⚪ | When true, FastAPI returns a diagnostic `trace` block (optional, safe default=false). |
| (future) `resume_embeddings`, `job_embeddings` | Extensible | Can be added later; backend will pass through once supported. |

### Response (`MatchResponse`)
| Field | Type | Required | Notes / Consumers |
| --- | --- | --- | --- |
| `match_score` | `number (0-1)` | ✅ | Stored as `MatchResult.matchScore` and rendered throughout UI. Keep deterministic & normalized. |
| `matched_skills` | `string[]` | ✅ | Displayed in HR dashboard and stored in DB. |
| `notes` | `string` | ✅ | Stored within `MatchResult.explanation.notes` for HR context. |
| `missing_critical_skills` | `string[]` | ⚪ | Saved to `MatchResult.missingSkills` and surfaced throughout review queues. |
| `embedding_similarity` | `number (0-1)` | ⚪ | Stored for diagnostics and explainability UIs. |
| `explanation` | `object` | ⚪ | Structured metadata including `components.skills/embeddings/experience/location`, per-component weights, normalized scores, and the same summary string returned in `notes`. Any new fields should be additive. |
| `trace` | `object \| null` | ⚪ | Present only when `include_trace=true`. Contains extraction/skills/score breakdown without raw resume text (redacted preview + hashes only). |

> **Production flows:** All persisted scores now originate from `/ai/match`. The Node heuristic matcher is available solely via `/matching/simulate` for experimentation.

> **Scoring breakdown:** The FastAPI service currently weighs skills (0.4), embeddings (0.3), experience (0.2), and location (0.1). Each component is clamped to [0, 1] and reported inside the `explanation.components` object so future tuning can be audited easily.

> **Tracing:** Set `TRACE_MATCHING=true` in the Node backend to request traces. The gateway adds `include_trace=true` and a request id header; the AI service returns a `trace` envelope containing redacted previews, lengths, coverage metrics, and per-component scores. When the flag is off, responses remain unchanged.

---

## `POST /ai/recommend`
**Usage today:** Not yet invoked. Model exists to support candidate-tailored job recommendations persisted via `Recommendation` schema.

### Request (`RecommendationRequest`)
| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `candidate_id` | `string \| null` | ⚪ | Enables lookup of stored preferences/history. |
| `skills` | `string[]` | ✅ (current expectation) | Resume-derived normalized skills. |
| `preferred_locations` | `string[]` | ⚪ | Optional filter list; may be empty. |

### Response (`RecommendationResponse`)
| Field | Type | Required | Notes / Consumers |
| --- | --- | --- | --- |
| `ranked_jobs` | `Array<{ job_id: string; title: string; score: number }>` | ✅ | Will be transformed into `Recommendation.recommendedJobs[{ jobId, score, rank, reason }]`. `score` must be 0–1. |
| `generated_at` | `ISO timestamp string` | ✅ | Stored as `Recommendation.generatedAt`. |
| `explanation`, `filters_applied` | Extensible | Safe to add for richer UI context once backend/frontends consume them. |

---

### Compatibility Notes
- **Field casing:** Backend currently tolerates both `snake_case` and `camelCase` for `match_score`/`matchScore`, `matched_skills`/`matchedSkills`. Going forward, the AI service should stick to the snake_case schemas above while backend keeps its fallback mapper until every consumer is updated.
- **Error handling:** AI service should return HTTP 4xx/5xx with `{ message, detail? }` JSON bodies. Backend wraps failures and stores `{ error: string }` inside `resume.parsedData` when parsing fails.
- **Extending schemas:** Always add new fields rather than renaming/removing existing ones. Coordinate backend/frontend updates when introducing new required outputs so the contracts stay synchronized.

