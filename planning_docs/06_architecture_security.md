# Architecture & Engineering Plan

## 1. System Architecture (Cloud-Native)

### High-Level Diagram
```mermaid
graph TD
    Client[React SPA] -->|HTTPS| CDN[CloudFront]
    Client -->|API Calls| LB[Load Balancer]
    LB --> API[Node.js Backend Cluster]
    
    subgraph "Async Processing Layer"
        API -->|Enqueue Job| Redis[Redis Queue]
        Worker[Python Worker] -->|Pop Job| Redis
    end
    
    subgraph "Data Layer"
        API -->|Metadata| Mongo[(MongoDB)]
        Worker -->|Metadata| Mongo
        API -->|Upload| S3[Object Storage]
        Worker -->|Read PDF| S3
    end
    
    subgraph "AI Services"
        Worker -->|RPC/HTTP| LLM[LLM Gateway (OpenAI/Anthropic)]
        Worker -->|Inference| Embed[Vector DB / Embedding Svc]
    end
```

### Components
1.  **Backend (Gateway)**: Handles Auth, Rate Limiting, Request Validation.
2.  **Worker Nodes**: Stateless Python containers that consume parsing/scoring jobs.
3.  **Object Storage (S3/MinIO)**: Secure storage for Resume PDFs. *Never store files on app server disk.*
4.  **Redis**: Job queue (BullMQ) and Caching (hot candidate profiles).

## 2. Database Schema (MongoDB)

### `Job`
- `_id`, `hrId`, `title`, `description_raw`
- `requirements`: `[{ id, type, weight, required }]`
- `stats`: `{ total_applicants, screened_count }`

### `Candidate`
- `_id`, `userId`
- `pii_data`: `{ name, email, phone }` (Encrypted at rest)
- `anonymized_profile`: `{ skills: [], experience: [] }` (Searchable)

### `Match`
- `jobId`, `candidateId`
- `score`: `0.0 - 1.0`
- `breakdown`: `{ lexical: 0.8, semantic: 0.6 }`
- `evidence`: `[{ reqId, snippet, confidence }]`

### `AuditLog`
- `timestamp`, `actorId`, `action` ("VIEW_CANDIDATE", "REJECT"), `resourceId`
- **Retention**: 1 year.

## 3. Security & Privacy Plan

### Data Protection
- **Encryption**: AES-256 for PII fields in Mongo. TLS 1.3 for all transit.
- **Access Control**: Pre-signed URLs for S3 resume access (valid for 5 mins). No direct public bucket access.
- **Secrets**: Use AWS Secrets Manager or HashiCorp Vault. Never `.env` in production.

### PII Handling (The "Blind" Protocol)
1.  **Ingest**: Resume uploaded -> PII Extracted & Removed from "Searchable Text".
2.  **Storage**: Original PDF stored in "Restricted" S3 bucket.
3.  **View**:
    - **Blind Mode**: UI fetches Anonymized Text.
    - **Full Mode**: UI requests temporary Pre-signed URL for original PDF (Logged in AuditTrail).

## 4. Scalability
- **Horizontal Scaling**: Node API and Python Workers scale independently based on CPU/Queue Depth.
- **Rate Limiting**: Per-user limits (e.g., 100 uploads/hour) to prevent DoS.
