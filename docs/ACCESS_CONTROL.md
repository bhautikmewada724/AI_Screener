# Frontend Access Control

Single guard layer for all protected routes lives in `frontend/src/layouts/RoleLayout.tsx`.

## Roles
- `admin`
- `hr`
- `candidate`

## Guard logic (authoritative)
- Ensures auth bootstrapping completes.
- Redirects unauthenticated users to `/login` (preserves message).
- Blocks users whose role is not in `allowedRoles` (renders `NotAuthorized`).
- Renders shared `AppShell` with role-specific nav and logout.

## Role configuration
- `frontend/src/config/roleConfig.ts` is the single source of truth for:
  - `allowedRoles`
  - `title/subtitle`
  - `navItems`
  - `landing` (useful for future redirects)

## Routing usage
- Routes mount `RoleLayout` directly; there is no extra `ProtectedRoute`.
- Examples (see `frontend/src/App.tsx`):
  - Candidate: `<RoleLayout allowedRoles={['candidate']} navRole="candidate" />`
  - HR: `<RoleLayout allowedRoles={['hr', 'admin']} navRole="hr" />`
  - Admin: `<RoleLayout allowedRoles={['admin']} navRole="admin" />`
  - Shared (notifications/preferences): `<RoleLayout allowedRoles={['admin','hr','candidate']} navRole="auto" />`

## Adding a new role or route group
1) Add a `RoleDefinition` entry in `roleConfig.ts` (allowedRoles, nav, title).
2) Mount routes under `<RoleLayout allowedRoles={[...]} navRole="<roleKey>" />` in `App.tsx`.
3) Ensure auth rules match backend expectations.

## Redirect rules
- Unauthenticated → `/login`.
- Unauthorized role → `NotAuthorized` page.
- Logout from any shell → `/login`.

## Notifications/SSE
- `AppShell` still renders `NotificationBell`; SSE token and endpoints unchanged.


