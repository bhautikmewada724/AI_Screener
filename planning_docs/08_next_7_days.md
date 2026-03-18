# Next 7 Days Plan (Kickoff)

## Day 1: Infrastructure & Cleanup
- [ ] Docker Compose setup for `Redis` and `MinIO` (S3 mock).
- [ ] Python Worker skeleton (Celery or BullMQ consumer).
- [ ] Update `.gitignore` and remove local `uploads/` folder.

## Day 2: Async Backend
- [ ] Create `QueueService` in Node.js.
- [ ] Refactor `POST /upload` to enqueue job and return `jobId`.
- [ ] Create `GET /jobs/:id` polling endpoint.

## Day 3: The Worker
- [ ] Move `resume_parser.py` logic into the Worker consumer.
- [ ] Ensure Worker can read/write to S3/MinIO.

## Day 4: OCR Integration
- [ ] Install `tesseract-ocr` in Python Docker image.
- [ ] Update parser to use OCR if text extraction yield < 50 chars.

## Day 5: Frontend Async UI
- [ ] Replace "Loading Spinner" with "Progress Bar" (polling `jobId`).
- [ ] Handle partial failures (e.g., "19/20 resumes processed").

## Day 6: Evaluation Setup
- [ ] Build the "Golden Dataset" (50 resumes).
- [ ] Write a script `evaluate_ranking.py` to benchmark current RSE.

## Day 7: Testing & Demo
- [ ] End-to-end test: Upload 50 resumes -> Check ranking.
- [ ] Record demo video for stakeholders.
