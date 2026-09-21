---
name: ui-ux-pro-max-final
description: Design principles and UI/UX Pro Max standards for Sorter.io. Enforces SVG icon normalization, balanced layout spacing, and premium SaaS glassmorphic components.
---

# UI/UX Pro Max Design Guidelines (Sorter.io)

## 1. Iconography & SVG Normalization
- **Universal Rounding**: All stroke-based SVG icons must have `stroke-linecap: round; stroke-linejoin: round;` to prevent sharp, jagged, or boxy strokes.
- **No Icon Squishing**: Always enforce `flex-shrink: 0;` on SVGs inside flex layouts so icons maintain their intended aspect ratio and don't collapse into slivers when containers resize.
- **Stroke vs Fill Isolation**: 
  - Line icons (Lucide / Feather style): `fill: none; stroke: currentColor; stroke-width: 2;`.
  - Silhouette / solid glyphs (e.g. GitHub logo, play polygons): `fill: currentColor; stroke: none;`.

## 2. Sidebar & Metadata Card Layout
- **No Overcrowded Inline Flows**: Do not bundle long title strings, dynamic version tags, and action buttons into a single continuous `<p>` or inline tag within narrow sidebars (<=260px).
- **Two-Row Structure**:
  - **Top Row (`.sidebar-footer-top`)**: Application Title on the left, pill version badge (`.footer-version-tag`) on the right.
  - **Bottom Row (`.sidebar-footer-bottom`)**: Engine/status microcopy on the left, external action badges (e.g. `.footer-link` for GitHub Releases) on the right.
- **Micro-Badges**: Action and version tags should feature subtle translucent backgrounds (`rgba(255, 255, 255, 0.04)` to `rgba(56, 189, 248, 0.12)`), fine borders, and rounded corners (`var(--radius-sm)` or `9999px`).

## 3. Micro-Interactions & Hover Polish
- **Transitions**: Keep hover states smooth with `transition: all var(--transition-fast)`.
- **Subtle Lift**: Interactive buttons and action tags should employ a gentle `-1px` vertical translation (`transform: translateY(-1px)`) and soft colored drop shadows on hover (`box-shadow: 0 2px 8px rgba(56, 189, 248, 0.18)`).
- **Active State Reset**: On `:active`, reset transform to `translateY(0)` for responsive tactile feedback.
