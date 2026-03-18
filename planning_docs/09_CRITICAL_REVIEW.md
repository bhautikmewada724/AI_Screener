# Critical Review & Remediation Plan

> **Reviewers**:
> - **Marcus (Enterprise CTO)**: "This won't scale and keeps me up at night."
> - **Sarah (Chief Compliance Officer)**: "This is a lawsuit waiting to happen."

---

## 🛑 Part 1: The Harsh Critique

### 1. From the CTO (Marcus)
**"You're building a toy, not a platform."**

*   **Dependency Hell**: You have proposed a distributed system (Node, Python, Redis, Mongo, S3, OpenAI, Textract) for an MVP. That's a DevOps nightmare for a 2-person team. "Docker Compose" isn't a production strategy. Where is the Infrastructure-as-Code (Terraform/CDK)?
*   **The "Polling" Trap**: You suggested `GET /jobs/:id` polling for the frontend. At Enterprise scale (recruiter uploading 500 resumes), 500 clients polling every second = DDoS yourself. **Fix**: Use Server-Sent Events (SSE) or WebSockets.
*   **Integration Delusion**: "Drag and drop 20 PDFs" is fine for a bakery hiring a cashier. Enterprises use Workday/Greenhouse. If you don't integrate with their ATS, you are just **more operational friction**. We need an "HR-XML" or "JSON Resume" standard import *now*.
*   **Cost Control**: You want to run LLM verification on *every* matching requirement? 50 candidates x 10 requirements x $0.01 = $5.00 per job search. If a large client runs 100 searches a day, you just burned $15,000/month on API fees. You need a "Tiered Compute" model.

### 2. From Legal/Compliance (Sarah)
**"You are optimizing for accurate bias."**

*   **The "Black Box" Liability**: You claim "Explainability," but you're using `SentenceTransformers` (embeddings). Embeddings effectively "launder" bias. If the model learned that "Lacrosse" correlates with "Success" (a proxy for wealth/class), it will rank those candidates higher without you knowing *why*.
*   **The "Rejection" Trap**: Your roadmap mentions "Reject" actions. **STOP.** AI must *never* make an adverse employment decision (FCRA violation in the US). The AI can *rank*, but it cannot *reject*. The UI buttons must reflect this.
*   **Data Retention Suicide**: "Retention: 1 year" is a liability. If a candidate asks to be forgotten (GDPR/CCPA) and you have their embeddings in a vector DB and their PDF in S3-Glacier, how do you verify deletion? You need a "Data Tombstone" architecture.
*   **Vendor Risk (OpenAI)**: You are sending candidate PII to OpenAI. Do you have a Zero-Data-Retention (ZDR) agreement? If not, OpenAI might train on your candidates. That's a privacy breach.

---

## ✅ Part 2: The Remediation Plan

### Fix 1: Architecture Simplification & Hardening (CTO)
*   **Action**: Switch "Job Queue" from Redis to **Postgres (pg-boss or Graphile Worker)**.
    *   *Why*: One less database to manage. ACID compliant job tracking.
*   **Action**: Implement **Server-Sent Events (SSE)** for updates.
    *   *Why*: Efficient, fire-wall friendly push notifications for parsing progress.
*   **Action**: **Cost Caching Strategy**.
    *   *Logic*: Hash(Resume Segment) -> Store Embedding. Don't re-embed "John Doe's Education" every time he applies to a new job.
    *   *Impact*: Reduces API costs by ~60%.

### Fix 2: Legal "Safety Rails" (Compliance)
*   **Action**: **"Blind" Embeddings**.
    *   *Technique*: Before embedding, regex-strip Names, Universities, and Locations. Only embed *Skills* and *Experience*.
    *   *Impact*: Reduces proxy bias from school prestige or demographics.
*   **Action**: **UI Terminology Change**.
    *   *Change*: Remove "Reject" button from AI views.
    *   *New Label*: "Mark as Not Relevant" (Sorts to bottom).
    *   *Mandatory Step*: Human must explicitly click "Send Rejection Email" (The AI never triggers this).
*   **Action**: **GDPR Purge API**.
    *   *Feature*: `POST /api/privacy/purge-candidate { email: ... }`.
    *   *Effect*: Hard deletes PDF, scrub Mongo record, deletes vector embedding, adds email to "Do Not Process" blocklist (hashed).

### Fix 3: Enterprise Readiness (Process)
*   **Action**: **Zero-Trust Token Exchange**.
    *   *Feature*: Instead of "SSO Later", use Auth0 (Free Ops Tier) *now*. It gives you 2FA and OIDC out of the box.
*   **Action**: **Tiered "Quality Gate"**.
    *   *Tier 1 (Fast)*: Keyword/Regex Search (Free).
    *   *Tier 2 (Paid)*: Embedding Semantic Search.
    *   *Tier 3 (Premium)*: LLM "Reasoning" & Explanation.
    *   *Why*: Solves the cost issue and allows upselling.

---

## 🛠 Revised Next 7 Days (Emergency Fixes)

1.  **Day 1**: **Auth0 Setup**. Don't write your own auth. It's a security hole.
2.  **Day 2**: **Postgres-based Queue**. Remove Redis dependency.
3.  **Day 3**: **PII Stripper Module**. Write the Python regexes to purge content *before* it hits the embedding model.
4.  **Day 4-7**: Remain on original plan (OCR + Async), but use the simpler stack.
