# Product Requirements Document (PRD)

## 1. Problem Statement
Recruitment is broken by volume. Recruiters spend 80% of their time screening unqualified candidates, often relying on "Ctrl+F" keyword searches that miss qualified talent (false negatives) or promote keyword stuffers (false positives). There is no "memory" or structured data to explain *why* a candidate was chosen, leading to bias and inefficiency.

## 2. Success Metrics
- **Metric 1**: **Screening Time Reduction** (Target: <5 mins to shortlist top 10 from 50 resumes).
- **Metric 2**: **Ranking Precision (NDCG@10)** (Target: >0.85 correlation with human ranking).
- **Metric 3**: **Recruiter Trust Score** (Target: 4/5 "I understand why AI picked this").

## 3. Product Scope

### Phase 1: MVP (The "Smart Screener") - 2-4 Weeks
*Goal: Single-user utility to rank resumes.*
- **Job Management**: Create Job, Parse JD, Edit Requirements (Must/Nice-to-have).
- **Candidate Processing**: Drag-and-drop PDF upload (Up to 20 at a time).
- **Intelligent Parsing**: Extract Skills, Exp, Education (Regex + Basic LLM fallback).
- **Explainable Ranking**: RSE (Rule-based) scoring with "Evidence Snippets".
- **Export**: Download ranked list as CSV/Excel.

### Phase 2: V1 (The "Collaborative Team") - 1-2 Months
*Goal: Team workflow and feedback loops.*
- **Feedback Loop**: "Thumbs up/down" on matches to tune weights.
- **Candidate View**: Rich profile view with "Match Highlights".
- **Notes & Collaboration**: @mention colleagues on candidate profiles.
- **Async Pipeline**: Background workers (BullMQ/Redis) for large uploads (100+).
- **Emails**: Send automated "Received" emails to candidates.

### Phase 3: Enterprise (The "Compliance Platform") - 3-6 Months
*Goal: Security, Scale, and Fairness.*
- **SSO**: SAML/OIDC integration (Okta/AD).
- **RBAC**: Granular roles (Recruiter vs Sourcer vs Hiring Manager).
- **Bias Monitoring**: Automated "Rooney Rule" checks and Adverse Impact analysis.
- **PII Redaction**: "Blind Hiring" mode (hides Name/Gender/School).
- **Audit Logs**: Immutable log of every view and decision.

## 4. Mandatory UX Screens
1.  **Job Command Center**: Input JD -> See extracted "Ranking Rubric" -> Adjust weights.
2.  **The "Queue"**: List of candidates with "Match Score" (Green/Yellow/Red).
3.  **Candidate Deep Dive**:
    - Left Panel: PDF Viewer.
    - Right Panel: "Why we picked them" (Evidence mapped to requirements).
4.  **Blind Mode Toggle**: One-click switch to hide PII while reviewing.

## 5. Non-Goals (MVP)
- Career Site / Public Job Board (Internal tool only).
- Automatic Interview Scheduling (Integration only).
- Video Interview Analysis (Privacy risk).
