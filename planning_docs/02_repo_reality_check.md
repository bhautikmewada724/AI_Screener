# Repo Reality Check

## 1. Executive Summary
**Current Status**: The project is a functional prototype (POC/MVP) with a clean separation of concerns. It implements a basic "Requirement Satisfaction Engine" (RSE) that ranks candidates based on keyword presence in specific resume sections.
**Strengths**:
- **Architecture**: Clean 3-tier separation (React, Node, Python) makes it easy to scale components independently.
- **Explainability**: The scoring logic (`rse_engine.py`) explicitly tracks *why* a match happened (e.g., "Found in Experience section"), which is superior to opaque embedding cosine similarity.
- **Hybrid AI**: It supports both heuristic (regex) and LLM-based parsing, allowing for cost/accuracy trade-offs.

**Weaknesses**:
- **Scalability**: The parsing and matching are synchronous HTTP calls. A large PDF or slow LLM response will timeout the backend.
- **Robustness**: Heuristic parsing is brittle. The keyword matching (`canonicalize_term`) is too simple (misses semantic synonyms unless LLM is used).
- **Enterprise Features**: Missing entirely (SSO, RBAC beyond simple roles, Audit Logs, Data Retention).

## 2. Repo Structure & Tech Stack
| Component | Tech Stack | Current Capabilities | Missing / Needs Improvement |
| :--- | :--- | :--- | :--- |
| **Frontend** | React, Vite, TS, Tailwind | Basic auth, Dashboard, Resume upload. | Complex data grids, result filtering, detailed candidate view. |
| **Backend** | Node.js, Express, Mongo | simple CRUD, Auth, Proxy to AI service. | Queue (Redis) for async jobs, Rate limiting, Caching. |
| **AI Service** | Python, FastAPI | Regex/LLM parsing, "Evidence-based" ranking. | Async processing, true Semantic Search (currently weak), OCR. |
| **Database** | MongoDB | Stores Users, Resumes, Jobs. | Indexing strategy, Data archival policies, Encrypted fields at rest. |

## 3. Analysis of AI/ML Pipeline
### Parsing (`resume_parser.py`)
- **Method**: extract text -> regex/LLM -> structured JSON.
- **Gap**: No OCR. If a candidate uploads an image-based PDF, it fails (returns empty text).
- **Risk**: The fallback regex parsing is very basic. It might miss "Experience" sections if they are named creatively (e.g., "Professional History").

### Ranking (`rse_engine.py`)
- **Method**: "Requirement Satisfaction" scoring. It looks for exact keyword matches (canonicalized) in specific sections.
- **Pros**: It accounts for *context* (Skill in 'Experience' > Skill in 'Skills' list).
- **Cons**: It's rigid. "React.js" matches "React", but "Frontend Engineering" might not match "UI Development" without an LLM or massive synonym dictionary.
- **Scoring**: Weighted sum (Strong=1.0, Weak=0.6, Uncertain=0.4).

## 4. Technical Debt & Risks
1.  **Synchronous Processing**: The biggest architecture risk. Processing a resume takes 2-10s (heuristic) or 15-30s (LLM). The browser will timeout. **Action**: Move to async worker pattern.
2.  **No OCR**: Image-only resumes (scans) are ignored. **Action**: Add Tesseract or cloud OCR.
3.  **Security**: `AI_SERVICE_URL` is internal, but the service has no auth. If deployed in a shared cluster, anyone can call it.
4.  **Data Privacy**: Resumes are stored on disk (`uploads/` in backend) or MongoDB. No PII masking before storage.

## 5. Assumptions for Planning
- **Target Audience**: Mid-market to Enterprise (requires high reliability & explainability).
- **Deployment**: Cloud-native (AWS/GCP) using containers.
- **Data Policy**: We must store full resumes for legal compliance/audit, but PII should be protected.
