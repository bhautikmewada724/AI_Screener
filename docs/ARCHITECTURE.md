# Architecture Overview

This monorepo hosts three services and a shared MongoDB datastore. Data always flows **Frontend → Backend → AI Service → MongoDB** for AI-assisted features; the frontend never calls the AI service directly.

## Services
### Frontend (`frontend/`)
- React + TypeScript + Vite, Tailwind utility classes defined in `src/styles.css`.
- Auth via JWT stored in `localStorage`, provided by `AuthContext` / `useAuth`.
- API helpers in `src/api/*.ts` call the backend (`VITE_API_BASE_URL`, default `http://localhost:5000`).
- Layouts: `AdminLayout`, `HrLayout`, `CandidateLayout` wrap pages with `AppShell` and `navItems`.
- Key candidate pages: dashboard, resumes, jobs, job detail, applications, recommendations.

### Backend (`backend/`)
- Node/Express (ESM) with JWT auth middleware (`authenticate`, `authorizeRoles`), Mongo via mongoose.
- Routers mounted in `src/app.js`: health, auth, ai proxy, resume, public jobs, hr jobs, hr workflow, applications, admin, matching, recommendations.
- AI gateway (`src/services/aiService.js`) calls FastAPI endpoints `/ai/parse-resume`, `/ai/parse-jd`, `/ai/match`, `/ai/recommend` using `AI_SERVICE_URL`.
- Recommendation flow: `recommendationService` loads candidate resume skills/embeddings, fetches open jobs excluding applied/dismissed, calls AI `/ai/recommend`, saves `Recommendation` documents per candidate, supports feedback (dismiss/save) and refresh.
- Swagger served at `/api-docs`; env: `MONGO_URI`, `JWT_SECRET`, `AI_SERVICE_URL`, `PORT`.

### AI Service (`ai-service/`)
- FastAPI with routers under `routes/`: resume, jd, match, recommendation. Entry: `main.py`.
- Pydantic models in `models/` (parse requests/responses, match, recommendation).
- Services in `services/`: `resume_parser`, `jd_parser`, `matching_service`, `recommendation_service` (skill + embedding scoring with location/seniority heuristics).
- Tests in `tests/` (`python -m pytest tests`); `PYTHONPATH=.` needed when running locally on Windows shells.

## Key Data Models
- `User` (roles: admin, hr, candidate).
- `Resume` (parsedData: summary, skills, experience, education, location, embeddings).
- `JobDescription` (title, description, required/nice-to-have skills, embeddings, metadata.seniorityLevel/jobCategory, status).
- `Application` (candidateId, jobId, resumeId, status, matchScore, matchedSkills).
- `MatchResult` (scored pairs; used by HR workflows).
- `Recommendation` (candidateId, recommendedJobs[{ jobId, score, rank, reason, status, feedbackReason, jobSnapshot, lastRecommendedAt }], generatedAt).

## Primary Flows
1. **Resume upload & parse**: Frontend uploads to backend `/resume/upload` → stored, then backend calls AI `/ai/parse-resume` → parsed data saved to `Resume`.
2. **Job create/parse**: HR creates job; optional AI `/ai/parse-jd` fills required skills/embeddings → saved to `JobDescription`.
3. **Matching**: Backend `/ai/match` proxies to FastAPI for a resume/job pair; results stored in `MatchResult`, shown in HR views.
4. **Recommendations (candidate)**:
   - Backend `GET /candidate/recommendations` (auth candidate) → if stale/missing, generate via `recommendationService` → AI `/ai/recommend` → save `Recommendation` doc and return populated job fields.
   - Feedback `POST /candidate/recommendations/feedback` updates status (`dismissed`, `saved`) scoped to `req.user.id`; dismissed jobs excluded on next generation.
5. **Applications**: Candidate applies (`POST /applications`) selecting resume; applied jobs excluded from future recommendations.

## Endpoints (selected)
- Backend public/auth:
  - `/auth/*`, `/resume/*`, `/jobs` (public open jobs), `/applications`, `/matching/*`, `/candidate/recommendations`, `/candidate/recommendations/feedback`.
- Backend HR/Admin:
  - `/hr/*` for job workflows, `/admin/*` for admin console.
- AI Service:
  - `GET /health`
  - `POST /ai/parse-resume`
  - `POST /ai/parse-jd`
  - `POST /ai/match`
  - `POST /ai/recommend`

## Running & Tests (summary)
- AI service: `cd ai-service && python -m pytest tests` (set `PYTHONPATH=.` on Windows shells).
- Backend: `cd backend && npm install && npm run dev` (tests: `npm test`).
- Frontend: `cd frontend && npm install && npm run dev` (build: `npm run build`).

## Notes
- Keep FastAPI private behind the backend; all frontend calls go through the Express gateway.
- Ensure env vars are set per service; do not hardcode secrets.
- Recommendations exclude applied and dismissed jobs; saved items receive a small positive bias on regenerate.
