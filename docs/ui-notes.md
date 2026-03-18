# UI Audit Notes (Phase 7 foundation)

## Routing & Layouts
- `App.tsx` gates routes via `ProtectedRoute`; HR and Admin areas use separate layout shells.
- `AdminLayout.tsx` already uses Tailwind utilities with a navy sidebar and shared `.admin-nav-link` class but HR layout is still inline-styled header + main.
- No shared layout component between HR/Admin; padding/background treatments differ.

## Shared Styles / Tokens
- `tailwind.config.ts` defines brand colors (brand.navy/accent/slate) and Inter as the primary font.
- `src/styles.css` registers base styles plus `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.card`, `.table`, `.status-badge`, and `.admin-nav-link`.
- Component layer lacks variants like ghost/outline buttons and has hard-coded drop shadows; cards/tables use inline styles elsewhere instead of these utilities.

## Pages / Components
- Many pages (AdminOverview, AdminUsers, HR Dashboard, JobDetail) mix `.card` with raw inline styles (e.g., flex gaps, colors, margins), leading to inconsistent spacing/typography.
- Tables are often custom-styled inline even though `.table` exists.
- Page headers (title + subtitle + actions) are manually reimplemented with inline `style` blocks on each page.
- Loading/Error states are uneven: `App.tsx` uses centered text, admin pages show plain `<p>Loading…`, others have no empty states.
- Components such as `StatCard`, `DistributionList`, `ResumeViewer` duplicate structure/styling; ideal candidates for shared UI primitives.
- HR layout uses raw CSS-in-JS for header + button, not Tailwind; sidebar nav paradigms differ between admin and HR areas.

## Opportunities
- Extract reusable UI primitives: `PageHeader`, `SectionCard`, `DataTable`, `KpiCard`, `SplitPanel`, etc.
- Expand component layer in `styles.css` (button variants, badges, empty state panels) and rely on those classes rather than ad-hoc inline styles.
- Standardize loading/empty/error UI via small React components (e.g., `<LoadingState />`).
- Align admin + HR shells on the same grid layout with shared nav-link classes and page padding.
- Use responsive Tailwind utilities instead of fixed pixel padding/margins for better small-screen behavior.
