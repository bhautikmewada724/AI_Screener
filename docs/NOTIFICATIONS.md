# Notifications & Messaging

End-to-end shape of the current notifications + messaging system, plus identified gaps for comment-triggered messaging.

## Backend surface

- `GET /api/notifications` — paginated list with optional `unreadOnly`, `type`, `fromDate`, `toDate`. Auth required.
- `POST /api/notifications/mark-read` — body `{ notificationIds: string[] }`. Auth required.
- `POST /api/notifications/mark-all-read` — mark every unread as read. Auth required.
- `GET /api/notification-preferences` — list per-user preferences. Auth required.
- `PUT /api/notification-preferences` — body `{ preferences: [{ typePattern, inAppEnabled?, emailEnabled?, digestMode?, quietHours? }, ...] }`. Auth required.
- `GET /api/notifications/stream` — SSE stream. Auth required; accepts `Authorization: Bearer <jwt>` header or `?token=<jwt>` query param for EventSource compatibility.
- `GET /api/unsubscribe?token=...&scope=...` — public unsubscribe endpoint; revokes email for `typePattern="*"` and records revocation.

### SSE event types

- `bootstrap`: `{ unreadCount }` sent immediately after connection.
- `notification`: `{ notification, unreadCount }` when a new in-app notification is created.
- `unread_count`: `{ unreadCount }` when counts change (mark read/mark all).
- `heartbeat`: `{}` every 30s to keep connections alive.

### Models and delivery

- `Notification` — per-user in-app record with `{ type, title, body, data, channelTargets, readAt }`.
- `NotificationDeliveryLog` — per-channel attempt with unique `idempotencyKey` (enforces idempotency). Status `queued|sent|failed|skipped`.
- `NotificationPreference` — per-user, per-`typePattern` channel toggles.
- `UnsubscribeToken` — generated per user/scope; used in unsubscribe links.
- Email worker: `npm run notification:worker` polls queued delivery logs and sends via `emailProvider`. Env: `SMTP_*`, `EMAIL_FROM`, `API_BASE_URL` or `APP_BASE_URL` (for unsubscribe link), optional `NOTIFICATION_WORKER_POLL_MS`, `NOTIFICATION_WORKER_BATCH`.

## Current triggers

- Application status change: `application.status_changed` emitted in `backend/src/controllers/hrWorkflowController.js` → notifies candidate with deep link to `/candidate/applications` (in-app + email, idempotent per application/status).

## Comment / messaging triggers

- Review note / comment creation (`backend/src/controllers/hrWorkflowController.addComment`):
  - Shared comments from HR/Admin notify the candidate (`application.comment_added`), excluding the author, with `applicationId`, `jobId`, `noteId`, `visibility`, and deep link to `/candidate/applications`.
  - Candidate-authored comments (if/when supported) notify the job owner (`job.hrId`) and `application.assignedTo`, excluding the author, with deep link to `/hr/jobs/{jobId}`.

## Frontend consumption (current)

- API client at `frontend/src/api/notifications.ts` for list, mark-read, mark-all, preferences.
- SSE consumption in `frontend/src/components/NotificationBell.tsx` using `EventSource` with `?token=` query param; falls back to polling every 30s.
- UI:
  - Bell in `AppShell` top bar with unread badge, dropdown preview (mark single/all read).
  - `/notifications` page lists/paginates/filter unread; uses server unreadCount.
  - `/settings/notifications` allows editing preferences (React Query + forms).

## Identified gaps / risks

- Candidate-authored comments are not yet exposed via routes; when added, ensure notifications reuse the same `application.comment_added` type and exclusion of the actor.
- No unread badge/source-of-truth sync test coverage yet; SSE bootstrap/heartbeat untested.
- Unsubscribe base URL defaults to `API_BASE_URL || APP_BASE_URL || http://localhost:5000`; worker now logs once when falling back to default.

## Run & QA notes

- Env vars (backend/worker): `MONGO_URI`, `JWT_SECRET`, `PORT` (default 5000), `APP_BASE_URL`, `API_BASE_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, optional `NOTIFICATION_WORKER_POLL_MS`, `NOTIFICATION_WORKER_BATCH`.
- Start backend: `cd backend && npm install && npm run dev`.
- Start notification worker: `cd backend && npm run notification:worker`.
- Start frontend: `cd frontend && npm install && npm run dev` (requires `VITE_API_BASE_URL=http://localhost:5000`).

### Manual QA checklist (comments → in-app → SSE → email)

1) Login as HR, open job application detail, add a shared comment; verify candidate account receives in-app notification (unread count increments).
2) While candidate is logged in with NotificationBell open, observe unread badge updates in real time without refresh (SSE event).
3) Click notification deep link; ensure navigation to `/candidate/applications`.
4) Mark notification read; unread badge decrements and server list shows read state after refresh.
5) Ensure author HR did not receive their own notification.
6) Start notification worker with SMTP envs; confirm DeliveryLog status transitions to `sent` and email contains unsubscribe link.
7) Use unsubscribe link; confirm subsequent email deliveries are skipped and preferences reflect `emailEnabled=false` for `*`.


