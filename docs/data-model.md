# Data Model Overview

This document summarizes the MongoDB collections that now back the AI Screener platform. All schemas live under `backend/src/models/` and are implemented with Mongoose using ES modules.

## Collections

### `users`
- Already defined in Phase 2.
- Roles: `admin`, `hr`, `candidate`.

### `resumes`
- Model: `Resume`
- Key fields:
  - `userId` → `User` reference (candidate owner, required, indexed).
  - `filePath` and `originalFileName` → uploaded asset metadata.
  - `status` → `uploaded | processing | parsed | failed`.
  - `parsedData` → AI output (`summary`, `skills`, `experience`, `education`, `embeddings`).
- Timestamps enabled. Index on `{ userId: 1, createdAt: -1 }`.

### `job_descriptions`
- Model: `JobDescription`
- Key fields:
  - `hrId` → `User` reference (HR owner, required, indexed).
  - `title`, `description`, `location`, `employmentType`, `salaryRange`.
  - `requiredSkills` array + optional `embeddings`.
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

## Sanity Script

- Run `npm run model:sanity` inside `backend/` to insert and immediately clean up sample documents that exercise all schemas. This script requires a valid `MONGO_URI`.

