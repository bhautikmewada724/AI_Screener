# User Personas & Workflows

## 1. User Personas

### 👤 The "High-Volume" Recruiter (Primary User)
- **Role**: Talent Acquisition Specialist handling 10-20 open roles at once.
- **Goals**: 
  1. Reduce "time-to-shortlist" from days to minutes.
  2. Avoid missing "hidden gems" (good candidates with bad resumes).
  3. Share top picks with Hiring Managers easily.
- **Pain Points**: 
  - Overwhelmed by spam applicants.
  - ATS keyword search is dumb (misses synonyms).
  - Bias allegations from rejected candidates.

### 👤 The "Skeptical" Hiring Manager
- **Role**: Engineering Manager or Team Lead.
- **Goals**:
  1. Interview only *relevant* candidates.
  2. Understand *why* a candidate was recommended without reading the whole resume.
  3. Ensure the person actually has the skills, not just the keywords.
- **Pain Points**:
  - Wasting time on phone screens with unqualified people.
  - Recruiter sending "keyword matches" who can't code.
  - Lack of context in the handover.

### 👤 The "Anxious" Candidate (Optional Interface)
- **Role**: Job seeker.
- **Goals**:
  1. Fair consideration (not auto-rejected by a bot).
  2. Quick feedback on status.
  3. Understanding what skills they lacked.
- **Pain Points**:
  - "Black hole" applications (no response).
  - Unknown formatting requirements (ATS compatible?).

## 2. Key Workflows (Step-by-Step)

### Workflow 1: The Screening Sprint (Recruiter)
1.  **Job Setup**: Recruiter pastes JD text or URL. System parses capabilities (Must-haves vs Nice-to-haves).
    *   *System Action*: Auto-weighted requirement generation.
2.  **Bulk Upload**: Recruiter drags & drops 50 PDF resumes.
    *   *System Action*: Async processing (Parsing -> Embedding -> Scoring). Progress bar shows status.
3.  **Review**: Dashboard shows a ranked list.
    *   *UI*: Top 3 cards highlighted with "Match Reasons" (e.g., "7 years Java experience found in projects").
4.  **Shortlist**: Recruiter moves 5 candidates to "Shortlist" and adds a note.
5.  **Share**: Generates a secure link for the Hiring Manager.

### Workflow 2: The Deep Dive (Hiring Manager)
1.  **Access**: Clicks link from Recruiter. sees "Shortlisted Candidates" view.
2.  **Inspect**: Clicks a candidate.
3.  **Verify**: Sees side-by-side view: "JD Requirement: Microservices" vs "Resume Snippet: 'Architected microservices using K8s...'".
4.  **Feedback**: Clicks "Reject" -> "Reason: Not enough leadership experience".
    *   *System Action*: Updates the ranking model for future searches (Feedback Loop).

### Workflow 3: Enterprise Compliance Audit (Admin)
1.  **Audit**: Compliance Officer logs in to check for bias.
2.  **Report**: Selects "Q3 Hiring Cycle".
3.  **Analyze**: Views "Disparate Impact Report".
    *   *Metric*: "Selection Rate for Gender X vs Gender Y".
4.  **Trace**: Drills down into a specific job to see *why* candidates were ranked low (e.g., "Missing 'Python' skill").
