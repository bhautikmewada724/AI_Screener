# AI Screener - Master Plan (Enterprise Transformation)

> **Quick Customization Notes**
> - **Target Platform**: Web App
> - **Deployment**: AWS (Containerized)
> - **Intended Users**: Mid-Market & Enterprise Recruiters
> - **Data Policy**: Store Resumes (S3 Encrypted), Redact PII for specific views.

---

## 1. Repo Reality Check

### Executive Summary
**Current Status**: The project is a functional prototype (POC/MVP) with a clean separation of concerns. It implements a basic "Requirement Satisfaction Engine" (RSE) that ranks candidates based on keyword presence in specific resume sections.
**Strengths**:
- **Architecture**: Clean 3-tier separation (React, Node, Python).
- **Explainability**: Scoring logic (`rse_engine.py`) tracks evidence.
- **Hybrid AI**: Supports heuristic + LLM parsing.

**Weaknesses**:
- **Scalability**: Synchronous processing is a major bottleneck.
- **Robustness**: Heuristic parsing is brittle; no OCR.
- **Enterprise Features**: Missing (SSO, Audit Logs, RBAC).

### Tech Debt & Risks
1.  **Synchronous Processing**: HTTP timeouts for large files. -> **Move to Async**.
2.  **No OCR**: Image PDFs fail. -> **Add Tesseract**.
3.  **Security**: Internal API has no auth. -> **Add JWT/Secret**.
4.  **Data Privacy**: Resumes on disk. -> **Move to S3 Encrypted**.

---

## 2. Product Vision & Strategy

### User Personas
1.  **The "High-Volume" Recruiter**: Needs speed (50 resumes -> 5 mins). Wants to avoid missing "hidden gems".
2.  **The "Skeptical" Hiring Manager**: Needs accuracy ("Why this person?"). Wants to see evidence mapped to requirements.
3.  **The "Anxious" Candidate**: Needs fairness.

### Key Workflows
1.  **Screening Sprint**: Recruiter uploads 50 PDFs -> System Parses/Ranks -> Dashboard highlights Top 3.
2.  **Deep Dive**: Hiring Manager validates candidate using "Evidence Snippets" (Side-by-side view).
3.  **Audit**: Admin checks for disparate impact (bias) in ranking results.

### Product Requirements (PRD)

| Feature | MVP (Weeks 1-4) | V1 (Months 1-2) | Enterprise (Months 3-6) |
| :--- | :--- | :--- | :--- |
| **Input** | Drag-n-drop (20 files), Parse JD | Email integration, Bulk Import | HRIS Integration (Workday) |
| **Parsing** | Regex + LLM Fallback (No OCR) | OCR Support, Better LLM | Multilingual Support |
| **Ranking** | Rule-based (RSE) | Hybrid Search (Vectors) | Feedback Loop Learning |
| **Privacy** | Basic Encryption | Candidate Notification | PII Redaction (Blind Mode) |
| **Security**| Basic Auth | Role-based Access | SSO, Audit Logs |

---

## 3. ML & Ranking System Design

### Core Philosophy: "Evidence-Based Hybrid Search"
`Score = (0.7 * Lexical_Precision) + (0.3 * Semantic_Recall)`

### The Pipeline
1.  **Ingest**: OCR -> Text -> **PII Stripping (Regex)** -> Structure (JSON).
    *   *Safety*: Names/Universities removed before embedding to reduce bias.
2.  **Filter (Retrieval)**:
    - **Lexical**: Did they mention "Python" in "Experience"? (Current RSE).
    - **Semantic**: `SentenceTransformers` (all-MiniLM-L6-v2) embedding similarity on *anonymized* text.
3.  **Judge (Re-ranking) [Premium Tier]**: Top 50 candidates verified by small LLM (e.g., "Rate proficiency 1-5 based on this snippet").

### Evaluation Framework
- **Golden Dataset**: 50 resumes manually ranked by humans.
- **Target Metric**: `NDCG@10 > 0.85` (AI ranking matches Human consensus).
- **Compliance Check**: AI never "Rejects". Candidates are only "Ranked Low". Human must strictly initiate rejection.

---

## 4. Architecture & Engineering

### Cloud-Native Design
- **Gateway**: Node.js (Express).
- **Auth**: **Auth0** (OIDC/SAML readiness) - *Replaces custom JWT logic.*
- **Queue**: **Postgres (Graphile/Pg-Boss)** - *Simpler than Redis for MVP.*
- **Workers**: Python Containers (FastAPI) doing the heavy ML lifting.
- **Storage**: S3 (Resumes), MongoDB (Metadata/Scores).

### Security
- **PII Protocol**: Encrypt sensitive fields (Name, Email) in DB. "Blind Mode" UI requests redacted text.
- **Access**: Pre-signed URLs for S3 access (short-lived).
- **Data Retention**: "Purge" API for GDPR compliance (Hard delete of Vectors + PDF).

---

## 5. Roadmap & Execution

### Phase 1: MVP (The Reliable Screener)
- [ ] **Infra**: Dockerize Workers + Redis.
- [ ] **Backend**: Async Job API (`POST /upload` -> `jobId`).
- [ ] **ML**: Add OCR fallback.
- [ ] **Frontend**: Async Progress Bar.

### Phase 2: V1 (The Smart Partner)
- [ ] **ML**: Hybrid Search (Embeddings).
- [ ] **UX**: Evidence Highlighting.
- [ ] **Feedback**: "Thumbs up/down" to tune weights.

## 6. Next 7 Days Plan
1.  **Day 1**: Docker Setup (Redis, MinIO, Worker).
2.  **Day 2**: Async Node Service (`QueueService`).
3.  **Day 3**: Port `resume_parser` to Worker.
4.  **Day 4**: Integrate Tesseract OCR.
5.  **Day 5**: Frontend Polling UI.
6.  **Day 6**: Build "Golden Dataset".
7.  **Day 7**: End-to-End Test.

---

## 7. Quality Gate & Self-Review

| Check | Status | Note |
| :--- | :--- | :--- |
| **Weakest Assumption** | ⚠️ | Converting strict keyword rules to embeddings might confuse users initially. **Mitigation**: Keep RSE "Evidence" visible. |
| **Scalability (10x)** | ✅ | Async Workers + S3 solves the file handling bottleneck. |
| **Bias Risk** | ⚠️ | Embedding models can have inherent bias. **Mitigation**: Regular "Disparate Impact" audits. |
| **Enterprise Fit** | ⚠️ | Lack of SSO is a dealbreaker for big corps. **Mitigation**: Pushed to Phase 3 but architecture supports it. |
