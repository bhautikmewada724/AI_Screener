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
| Frontend | React, TypeScript, Vite (planned), JWT in `localStorage` |
| Backend | Node.js (ES modules), Express.js, Swagger/OpenAPI, MongoDB driver |
| AI Service | Python, FastAPI, NLP/LLM tooling (to be defined), Pydantic |
| Database & Infra | MongoDB Atlas (planned), containerized deployment |

## Intended Folder Structure

- `frontend/`
  - `src/` → React components, routing, state, hooks.
  - `public/` → static assets.
  - `.env` → `REACT_APP_API_BASE_URL`.
- `backend/`
  - `src/` → Express server, routes, controllers, services, data models.
  - `config/` → environment loaders (uses ES modules).
  - `swagger/` → OpenAPI definitions kept current with endpoints.
  - `.env` → `MONGO_URI`, `JWT_SECRET`, `AI_SERVICE_URL`, `PORT`.
- `ai-service/`
  - `app/` → FastAPI routers, services, AI pipelines.
  - `models/` → ML artifacts, embeddings, or prompts.
  - `.env` → `PORT`.
- `docs/`
  - `roadmap.md` → phase tracking (Phase 0 currently IN PROGRESS).

## Project Rules & Conventions

- Frontend must never talk directly to FastAPI.
- Node backend owns all business logic and API surface.
- FastAPI service contains only AI/NLP/matching logic.
- JWT must be stored in frontend `localStorage`.
- Node backend uses ES modules exclusively.
- Swagger/OpenAPI docs stay in sync with backend endpoints.

## Configuration Strategy

Each service maintains its own `.env` file (ignored by git) for clarity and least privilege. Shared secrets (e.g., `JWT_SECRET`) reside only where needed, and inter-service URLs (e.g., `AI_SERVICE_URL`) point to private network addresses or service discovery entries.

