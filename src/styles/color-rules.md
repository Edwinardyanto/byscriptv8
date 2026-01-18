# byScript Color Rules v1

## Palette (v1)
- Hyper Lime — `#66FF33` (Primary Accent)
- Jet Black — `#000000` (Primary Base)
- Pure White — `#FFFFFF` (Primary Text)
- Graphite Gray — `#1A1A1A` (Dark Layer)
- Lime Pulse — `#AFFF5C` (Accent Hover)
- Cyan Signal — `#00F7D5` (Secondary Accent)
- Code Purple — `#3D2C8D` (Deep Contrast)
- Soft Silver — `#D9D9D9` (Neutral Border)
- Neon Coral — `#FF5F5F` (Alert Color)
- Dark Steel — `#2A2F3A` (Background Contrast)

## Global background
- Default app background: **Jet Black**.
- Section-level contrast background: **Dark Steel** only.
- Dark Layer surfaces may sit on top of either background for depth.

## Panels / cards
- Panel background: **Graphite Gray**.
- Raised or emphasized panels: **Dark Steel**.
- Avoid using accents on panel backgrounds.

## Primary text
- Default text: **Pure White** on all surfaces.
- Use at 100% opacity only.

## Secondary / muted text
- Use **Soft Silver** at reduced opacity (60–75%) for secondary text.
- Never use accent colors for muted text.

## Primary CTA
- Fill or outline uses **Hyper Lime**.
- Text on Hyper Lime: **Jet Black** only.
- One primary CTA per visual cluster.

## Secondary CTA
- Default: **Graphite Gray** or **Dark Steel** background with **Pure White** text.
- Optional accent: **Cyan Signal** outline or icon only.
- Must never match emphasis of the primary CTA.

## Hover and active states
- Hover/focus state color: **Lime Pulse** only.
- Apply to borders, glows, or underline; never as a static fill.
- Active/selected state returns to base color with subtle contrast (no Lime Pulse).

## Borders and dividers
- Use **Soft Silver** at 15–25% opacity.
- Do not use accent colors for standard dividers.

## Alerts (error, warning, action-needed)
- Critical only: **Neon Coral**.
- Backgrounds use **Neon Coral** at 10–15% opacity as an overlay.
- Text stays **Pure White**; icons may use **Neon Coral**.
- No other alert colors are permitted.

## Charts
- Use softened/desaturated versions of palette colors only.
- Only one slice/line may use **Hyper Lime** (muted to 70–80% saturation).
- Support colors: muted **Cyan Signal**, muted **Code Purple**, muted **Soft Silver**.
- Chart lines/slices must never compete with primary UI accents.

## Navigation (active vs inactive)
- Inactive: **Soft Silver** at 60–70% opacity.
- Active: **Pure White** text with **Hyper Lime** indicator only.
- Never apply Hyper Lime to multiple nav items simultaneously.

## Status indicators (active, live, stopped)
- Active: **Hyper Lime** (dot or label only).
- Live: **Cyan Signal** (dot or label only).
- Stopped: **Soft Silver** at 60–70% opacity.
- Status colors must not be used as background fills.

## Hierarchy rules
- **Hyper Lime** is reserved for the single primary accent per cluster.
- **Cyan Signal** and **Code Purple** are secondary accents and must not appear next to or on top of **Hyper Lime** in the same cluster.
- If a cluster uses **Hyper Lime**, other accents in that cluster must be neutral or muted.
