# Dev Notes – Phase 7 AI Upgrade

## Architecture Snapshot
- `backend/` – Node/Express API (`src/app.js`) with Mongoose models such as `Resume`, `JobDescription`, `MatchResult`, and `Recommendation`. AI-facing orchestration lives in `src/services/aiService.js`, `matchingService.js`, and controllers.
- `ai-service/` – FastAPI app (`ai-service/main.py`) exposing `/ai/parse-resume`, `/ai/parse-jd`, `/ai/match`, and `/ai/recommend`. Each endpoint uses Pydantic models defined in `ai-service/models/*.py`. Current implementations live under `ai-service/routes/*` and still return mock payloads.
- `frontend/` – React + Vite client consuming backend REST endpoints via `src/api/*.ts`. Types in `src/types/api.ts` (e.g., `ResumePayload`, `ApplicationRecord`) mirror backend Mongo schemas and dictate what the UI expects from AI outputs.

## Current Data Flow (Resume → AI → Backend → Frontend)
1. **Upload & storage**
   - Candidates call `POST /resume/upload` (`backend/src/routes/resumeRoutes.js`). `resumeController.uploadResume` saves the file via Multer, creates a `Resume` document, and immediately calls `parseResumeAI` from `src/services/aiService.js`.
2. **AI resume parsing**
   - Backend sends `{ file_path, file_name, user_id, resume_text? }` to `ai-service` `/ai/parse-resume` (`ai-service/routes/resume_routes.py`).
   - Response: `summary`, `skills[]`, `experience[]`, `education[]`, `embeddings[]` (`ai-service/models/resume.py`). Backend stores this under `resume.parsedData` and moves status ➜ `parsed`.
3. **Job descriptions**
   - HR/Admins create jobs through `POST /jobs` (`backend/src/controllers/jobController.js`). Required skills are currently provided manually; `/ai/parse-jd` exists but is not yet wired up. Any embeddings passed from the AI service are persisted in `JobDescription.embeddings`.
4. **Matching loop**
   - When applications are created (`applicationController.applyToJob`) or HR views queues/matches (`hrWorkflowService.ensureMatchResult`, `jobController.getJobMatches`), backend calls `/ai/match` with:
     ```json
     {
       "resume_skills": resume.parsedData.skills,
       "job_required_skills": job.requiredSkills,
       "resume_summary": resume.parsedData.summary,
       "job_summary": job.description
     }
     ```
   - AI service returns `{ match_score, matched_skills, notes }` (`ai-service/models/match.py`). Backend persists scores inside `MatchResult` and surfaces them via `/matching/jobs/:jobId`, `/hr/jobs/:jobId/review-queue`, etc.
5. **Frontend consumption**
   - HR dashboard (`frontend/src/pages/JobDetailPage.tsx`) calls `fetchJobMatches` (`frontend/src/api/matching.ts`) and HR workflow APIs (`frontend/src/api/hr.ts`).
   - UI expects `matchScore`, `matchedSkills`, `explanation` objects, and resume `parsedData` fields defined in `frontend/src/types/api.ts`.

## ai_service Contract Touchpoints (pre-upgrade)
- `/ai/parse-resume` ↔ `ResumeParseRequest/Response` (`models/resume.py`).
- `/ai/parse-jd` ↔ `JobDescriptionRequest/Response` (`models/job.py`).
- `/ai/match` ↔ `MatchRequest/Response` (`models/match.py`).
- `/ai/recommend` ↔ `RecommendationRequest/Response` (`models/recommendation.py`), not yet consumed downstream.

These contracts currently drive backend expectations in `resumeController`, `hrWorkflowService.ensureMatchResult`, `jobController.getJobMatches`, and `Application` creation, and they bubble up to frontend components that render `matchScore`, skill breakdowns, and resume insights.

