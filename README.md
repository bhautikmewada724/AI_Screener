# AI Screener

An applicant-matching platform that combines a React frontend, a Node.js backend, and a FastAPI AI microservice over a shared MongoDB datastore. Phase 0 focuses on structure, configuration, and architectural clarity before any implementation begins.

## High-Level Architecture

1. **Frontend (React SPA)** → handles UX, stores JWT in `localStorage`, and calls the Node backend.
2. **Backend (Node.js / Express)** → single gateway for business logic, persistence orchestration, and Swagger-documented APIs.
3. **AI Service (FastAPI)** → encapsulates AI/NLP/matching routines exposed only to the backend.
4. **MongoDB** → primary database for user, job, and screening data.

Data always flows `Frontend → Backend → FastAPI → MongoDB` when AI assistance is needed. The frontend never talks directly to FastAPI, and AI-specific computations never live inside the Node layer.

## User Roles

- **Admin**: manages platform settings, approvals, and system oversight.
- **HR**: owns job postings, candidate reviews, and collaboration workflows.
- **Candidate**: submits profiles, tracks application status, and receives feedback.

## Core Tech Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React, TypeScript, Vite, React Query, JWT in `localStorage` |
| Backend | Node.js (ES modules), Express.js, Swagger/OpenAPI, MongoDB driver |
| AI Service | Python, FastAPI, NLP/LLM tooling (to be defined), Pydantic |
| Database & Infra | MongoDB Atlas (planned), containerized deployment |

## Intended Folder Structure

- `frontend/`
  - `src/` → React components, routing, state, hooks.
  - `public/` → static assets.
  - `.env` → `VITE_API_BASE_URL` (defaults to `http://localhost:5000`).
- `backend/`
  - `src/` → Express server, routes, controllers, services, data models.
  - `config/` → environment loaders (uses ES modules).
  - `uploads/resumes/` → local storage for candidate resumes in development.
  - `swagger/` → OpenAPI definitions kept current with endpoints.
  - `.env` → `MONGO_URI`, `JWT_SECRET`, `AI_SERVICE_URL`, `PORT`.
- `ai-service/`
  - `app/` → FastAPI routers, services, AI pipelines.
  - `models/` → ML artifacts, embeddings, or prompts.
  - `.env` → `PORT`.
- `docs/`
  - `roadmap.md` → phase tracking (Phase 0 currently IN PROGRESS).
  - `data-model.md` → MongoDB schemas and relationships.

## Project Rules & Conventions

- Frontend must never talk directly to FastAPI.
- Node backend owns all business logic and API surface.
- FastAPI service contains only AI/NLP/matching logic.
- JWT must be stored in frontend `localStorage`.
- Node backend uses ES modules exclusively.
- Swagger/OpenAPI docs stay in sync with backend endpoints.
- HR-only endpoints live under `/hr/**` and always use `authenticate` + `authorizeRoles('hr','admin')`.
- Candidate application submission routes live under `/applications` and are limited to `candidate` role.

## Core Data Models

| Collection | Purpose | Key Relationships |
| --- | --- | --- |
| `users` | Auth & RBAC identities | Roles: admin, hr, candidate |
| `resumes` | Candidate uploads + AI parsed data (`parsedData`) | `userId → users._id` |
| `job_descriptions` | HR-authored job postings + AI metadata | `hrId → users._id` |
| `match_results` | Resume ↔ job match scores + matched skills | `resumeId → resumes._id`, `jobId → job_descriptions._id` |
| `recommendations` | Ranked job suggestions per candidate | `candidateId → users._id`, each entry links to `job_descriptions` |
| `applications` | Candidate ↔ job workflow records | `candidateId → users._id`, `jobId → job_descriptions._id`, `resumeId → resumes._id` |
| `review_notes` | HR collaboration comments | `applicationId → applications._id`, `authorId → users._id` |
| `audit_events` | Immutable workflow actions | `applicationId → applications._id`, `actorId → users._id` |

HR workflows leverage these collections for CRUD operations and cached candidate matching per job.

See `docs/data-model.md` for field-level detail, indexes, and sanity test instructions.

## Configuration Strategy

Each service maintains its own `.env` file (ignored by git) for clarity and least privilege. Shared secrets (e.g., `JWT_SECRET`) reside only where needed, and inter-service URLs (e.g., `AI_SERVICE_URL`) point to private network addresses or service discovery entries.

## Phase 6 – HR Workflows

Phase 6 introduces the HR tools defined in `docs/roadmap.md`:

- **Backend**
  - New `Application`, `ReviewNote`, and `AuditEvent` models plus workflow metadata added to `JobDescription`.
  - Candidate application submission endpoints (`POST /applications`, `GET /applications/me`).
  - `/hr` workflow routes for review queues, status transitions (shortlist, reject, hire), match-score refresh, threaded comments, and audit trails.
  - Shared `hrWorkflowService` module centralizes ownership checks, AI scoring, and audit logging.
- **Frontend**
  - Vite + React dashboard under `frontend/` with login → HR dashboard → job-specific workflow views.
  - Candidate list with match scores, resume viewer, shortlist manager, comment system, and audit timeline.
  - React Query keeps UI responsive and caches queue data per job.
- **Documentation**
  - `docs/data-model.md` & `docs/roadmap.md` refreshed with workflow scope, and this README now documents the HR flows.

## Frontend Setup

```bash
cd frontend
npm install
echo "VITE_API_BASE_URL=http://localhost:5000" > .env
npm run dev
```

Visit `http://localhost:5173` and sign in with an HR- or admin-role account created via `/auth/register`. The frontend stores the JWT in `localStorage` and routes requests through the backend gateway only.

## Client State (Redux + React Query)

- React Query remains the source of truth for server data, caching, and request lifecycles.
- Redux Toolkit centralizes client-only state (auth session, UI toggles) under `frontend/src/store`.
- The auth slice hydrates from and persists to `localStorage` (`ai-screener-auth`) so JWTs survive refresh.
- Use the `useAuth` hook for login/logout/token access; avoid duplicating backend lists in Redux.

## Phase 7 – Admin Console

The Admin Console adds platform oversight tools:

- **Backend**
  - New `/admin` endpoints for listing users, viewing user detail, updating roles/status (with safeguards against removing the last admin), and fetching system metrics.
  - `adminService` reuses RBAC middleware and logs sensitive actions in `AuditEvent`.
  - `User` schema now includes `status` (`active|inactive|banned`) and `lastLoginAt`.
- **Frontend**
  - Admin-only layout with sidebar navigation.
  - System Overview page showing key stats (users/jobs/applications).
  - User Management list with filters, role/status controls, and per-user detail view.
  - Role-based routing automatically sends admins to `/admin/overview` after login.
- **Docs**
  - Swagger tag “Admin” enumerates all admin APIs.
  - Roadmap marks Phase 7 as in progress.

## Phase 8 – AI Matching Logic (in progress)

- **Matching service**: `backend/src/services/matchingService.js` computes deterministic scores from skills, experience, location, and tags with configurable weights plus structured explanations.
- **Endpoints**: `/matching/jobs/{jobId}` returns ranked candidates with explanations; `/matching/simulate` lets admins test specific pairs.
- **Frontend**: HR job detail page now includes an “AI Ranked Candidates” card highlighting top matches and explanation details.
- **Tests**: Node test suite covers scoring helpers; `npm run test` executes them.
- **Configuration**: adjust feature weights via env vars `MATCH_WEIGHT_SKILLS`, `MATCH_WEIGHT_EXPERIENCE`, `MATCH_WEIGHT_LOCATION`, and `MATCH_WEIGHT_TAGS`.
#*** End Patch

