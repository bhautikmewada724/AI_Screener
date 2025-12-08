# Data Model Overview

This document summarizes the MongoDB collections that now back the AI Screener platform. All schemas live under `backend/src/models/` and are implemented with Mongoose using ES modules.

## Collections

### `users`
- Already defined in Phase 2.
- Roles: `admin`, `hr`, `candidate`.
- Status field: `active | inactive | banned` (defaults to `active`) enables admin account controls.
- Tracks `lastLoginAt` for admin auditing.

### `resumes`
- Model: `Resume`
- Key fields:
  - `userId` → `User` reference (candidate owner, required, indexed).
  - `filePath` and `originalFileName` → uploaded asset metadata (stored under `backend/uploads/resumes/` during development).
  - `status` → `uploaded | processing | parsed | failed`.
  - `parsedData` → AI output (`summary`, `skills`, `experience`, `education`, `embeddings`).
- Timestamps enabled. Index on `{ userId: 1, createdAt: -1 }`.

### `job_descriptions`
- Model: `JobDescription`
- Key fields:
  - `hrId` → `User` reference (HR owner, required, indexed).
  - `title`, `description`, `location`, `employmentType`, `salaryRange`.
  - `requiredSkills` array + optional `niceToHaveSkills` for AI-enriched hints, plus optional `embeddings`.
  - `metadata` (Mongoose Map) captures AI-derived attributes such as `seniorityLevel`, `jobCategory`, and `aiSummary`.
  - Workflow metadata: `status` (`draft|open|on_hold|closed|archived`), `openings`, `tags`, and `reviewStages`.
- Timestamps enabled. Index on `{ title: 1 }`.

### `match_results`
- Model: `MatchResult`
- Key fields:
  - `resumeId` → `Resume` reference (indexed).
  - `jobId` → `JobDescription` reference (indexed).
  - `matchScore` (0–1), `matchedSkills`, optional `explanation`.
- Compound unique index on `{ resumeId: 1, jobId: 1 }`.

### `recommendations`
- Model: `Recommendation`
- Key fields:
  - `candidateId` → `User` reference (unique + indexed).
  - `recommendedJobs` array with `{ jobId, score, rank, reason }`.
- `generatedAt` + timestamps capture staleness.

## Relationships

- `User (candidate)` → `Resume` (one-to-many).
- `User (hr)` → `JobDescription` (one-to-many).
- `Resume` ↔ `JobDescription` via `MatchResult` (many-to-many).
- `Recommendation` stores the latest ranked list of `JobDescription` documents for each candidate.

### `applications`
- Model: `Application`
- Represents a candidate + resume paired to a job posting and tracks workflow status.
- Fields: `jobId`, `candidateId`, `resumeId`, optional `matchResultId`, `status`, `reviewStage`, `assignedTo`, `matchScore`, `matchedSkills`, `decisionReason`, `notesCount`, `metadata`.
- Indexes:
  - `{ jobId: 1, candidateId: 1 }` unique (prevents duplicate applications).
  - Single-field indexes on `jobId`, `candidateId`, `status` for queue filtering.

### `review_notes`
- Model: `ReviewNote`
- Stores threaded HR comments on an application.
- Fields: `applicationId`, `authorId`, `body`, `visibility ('shared' | 'private')`.
- Indexed by `applicationId` for quick retrieval inside the workflow UI.

### `audit_events`
- Model: `AuditEvent`
- Immutable append-only record of workflow actions (status changes, comments, score refresh, submissions).
- Fields: `applicationId`, `actorId`, `action`, `context` (arbitrary key/value map).
- Indexed by `applicationId`; includes timestamps for chronological timelines.

## Sanity Script

- Run `npm run model:sanity` inside `backend/` to insert and immediately clean up sample documents that exercise all schemas. This script requires a valid `MONGO_URI`.

