# Notifications & Messaging Removal

This codebase previously implemented in-app/email notifications, SSE streams, and preferences. The entire feature set has been removed for safety and simplicity.

## What was removed
- Backend: notification routes/controllers/services/stream, models (Notification, NotificationPreference, NotificationDeliveryLog, UnsubscribeToken), notification email worker, templates/provider, and notification-related tests.
- Frontend: NotificationBell, notification API client, notifications list/preferences pages, SSE/EventSource usage, notification routes, nav items, and related tests/styles.
- Docs/scripts: notification docs/runbook, README references, worker script, env references specific to notifications.

## Impact
- No `/api/notifications*` or SSE endpoints exist.
- No notification worker or email delivery for notifications.
- UI has no notification bell, list, or preferences.
- Core auth/HR/candidate/admin flows remain unchanged.

## How to reintroduce later (scaffolding hints)
- Recreate backend surfaces: routes under `/api/notifications`, models, and an emit service; add SSE broadcaster if needed.
- Add a worker or background job for email delivery if re-enabled.
- Re-add frontend API module, SSE client, and bell/list pages; mount routes and nav entries via `ROLE_CONFIG`.
- Document env vars and run instructions when reintroducing.

