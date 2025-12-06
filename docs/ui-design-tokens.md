# UI Design Tokens & Primitives

These tokens sit on top of the existing Tailwind + Inter setup. They are intentionally lightweight so the React UI stays familiar but consistent.

## Colors
- `brand.navy` (`#0f172a`): primary background/heading color, sidebar container.
- `brand.accent` (`#2563eb`): focus ring + interactive highlight.
- `brand.slate` (`#1e293b`): deep text, button contrast.
- `brand.ash` (`#475569`): muted body copy, subtitles.
- `brand.surface` (`#f8fafc`): dashboard background + cards-on-canvas contrast.

## Shadows & Radius
- `shadow-card-lg`: `0 20px 60px rgba(15, 23, 42, 0.08)` – primary panel shadow.
- `shadow-card-sm`: `0 6px 20px rgba(15, 23, 42, 0.06)` – subtle hover/inline cards.
- Border radius tokens: `rounded-xl` (1rem) for cards/buttons, `rounded-2xl` (1.5rem) for hero/panel surfaces.

## Component Classes (`@layer components`)
- **Buttons**: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-plain`, `.btn-danger`.
- **Shell utilities**: `.sidebar-shell`, `.sidebar-panel`, `.sidebar-nav-link` (with `.active` state), `.page-shell` for page spacing.
- **Page header**: `.page-header`, `.page-title`, `.page-subtitle` handle title/subtitle/action alignment.
- **Surfaces**: `.card`, `.section-card`, `.chip`, `.badge`, `.badge-muted` unify panel styles and label chips.
- **Tables**: `.table` styles header, body rows, and hover state.
- **Status + state blocks**: `.status-badge` variants, `.empty-state`, `.loading-state`, `.error-state` for consistent feedback.

Use these primitives before introducing new one-off styles so pages inherit consistent spacing, typography, and focus behavior. If a new component needs a variation, extend these classes rather than duplicating inline styles.
