# Roadmap & Execution Plan

## 1. Phased Roadmap

### Phase 1: MVP - The Reliable Screener (Weeks 1-4)
*Goal: It works reliably for 50 resumes without crashing.*
- [ ] **Infra**: Dockerize Python Service + Redis + BullMQ.
- [ ] **Backend**: Implement Async Job status polling.
- [ ] **ML**: Add OCR (Tesseract) fallback for image PDFs.
- [ ] **Frontend**: Fix Upload UI to handle async progress bar.
- [ ] **Deploy**: AWS Lightsail or DigitalOcean Droplet.

### Phase 2: V1 - The Intelligent Partner (Weeks 5-12)
*Goal: Recruiters trust the score.*
- [ ] **ML**: Implement Hybrid Search (Embeddings + Keywords).
- [ ] **UX**: "Candidate Deep Dive" view with evidence highlighting.
- [ ] **Feedback**: "Thumbs up/down" to capture training data.
- [ ] **Notification**: Email alerts on job completion.

### Phase 3: Enterprise - The Compliance Engine (Months 3-6)
*Goal: Sell to HR Departments.*
- [ ] **Security**: SSO (Okta/Google).
- **Privacy**: Blind Hiring Mode.
- **Audit**: Comprehensive logs.

## 2. Prioritized Backlog (P0/P1/P2)

| Priority | Task | Description |
| :--- | :--- | :--- |
| **P0** | **Async Architecture** | Move parsing/scoring to background workers. Fixes timeouts. |
| **P0** | **OCR Support** | Handle image-based PDFs. (Currently 20% of resumes fail). |
| **P0** | **Secure Storage** | Move `uploads/` to S3 (localstack for dev). |
| **P1** | **Hybrid Search** | Add `sentence-transformers` to ranking logic. |
| **P2** | **Blind Mode** | Toggle to hide Name/Email in UI. |

## 3. Risk Register (Top 5)

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| **LLM Costs Explode** | High ($$) | Use OpenAI Batch API + Caching (Redis). Fallback to local BERT for simple tasks. |
| **Bias/Fairness Lawsuit** | Critical | "Explainability First" UI. Never show a score without a reason. Audit logs. |
| **Resume Parsing Fragility** | Medium | Use multiple parsers (LLM + Rule-based) and "ensemble" the results. |
| **Data Leakage** | Critical | Strict S3 bucket policies. Ephemeral pre-signed URLs. |
| **User Distrust** | High | Start with "Human-in-the-loop" UI (AI suggests, Human clicks). |
