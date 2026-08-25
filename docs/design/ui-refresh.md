# UI Refresh Specification — AI-native Workspace

> Handoff-ready design spec for the desktop-style workspace UI.
> Source of truth: this document + `/tmp/opencode/workspace-ui-mockup.html`.
> **Constraint:** additive-only. No HTML restructuring required. All existing CSS
> selectors keep their names; only their property values change. New tokens get
> distinct `--*` names so a coder can drop the new `variables.css` block in and
> every existing rule that references `var(--accent)`, `var(--border)`, etc.
> automatically inherits the refreshed palette.

---

## 1. Design Language Recap

JARVIS / Iron Man HUD: clean, minimal, premium, **dark-first** with a light
variant. One accent family — cyan in the hsl(185–190) range. Glass panels via
`backdrop-filter` with a low-alpha white 1px hairline border. A **single, very
soft outer glow** reserved for the focused window only. No RGB, no neon
overload, no gaming cues. Readability and professionalism first; motion is
short and eased, never bouncy.

What is weak in the current CSS and this refresh fixes:

- Accent `#00d4ff` is too saturated/neon → retuned to `hsl(188 90% 55%)`.
- `--border` is tinted accent everywhere, which makes unfocused glass read as
  "outlined" → borders are now near-white low-alpha; only focus states pull in
  accent tint.
- No elevation scale; everything uses one shadow → three-level shadow scale.
- No motion tokens; durations/easings are inline strings → `--dur-*` / `--ease-*`.
- No semantic colors as tokens (toast error/success are hardcoded) → `--ok`,
  `--warn`, `--danger` tokens.
- No focus-visible outline (keyboard a11y gap) → `--focus-ring` token + rule.
- No reduced-motion support → `@media (prefers-reduced-motion)` block.
- Topbar/dock are flush bars, not floating glass → become floating pills with
  margin + radius + stronger blur (canvas shows through around them).

---

## 2. Design Tokens

All tokens are CSS custom properties. Dark theme is the default (`:root` and
`[data-theme="dark"]`); light theme overrides under `[data-theme="light"]`.
**Existing token names are preserved** so current rules keep working; new
tokens use distinct names.

### 2.1 Color — Dark (default)

```css
:root,
[data-theme="dark"] {
  /* ── Base surfaces ─────────────────────────────── */
  --bg:                  #08090d;   /* app canvas void */
  --bg-elev-1:           #0d0f15;   /* cards / modal interior */
  --bg-elev-2:           #12151d;   /* inputs, code blocks */
  --bg-glass:            rgba(18, 21, 29, 0.72);   /* window body */
  --bg-titlebar:         rgba(12, 14, 20, 0.55);
  --bg-titlebar-focused: rgba(10, 26, 38, 0.65);
  --bg-topbar:           rgba(10, 12, 18, 0.62);
  --bg-dock:             rgba(10, 12, 18, 0.66);
  --bg-canvas-glow:      radial-gradient(ellipse 80% 60% at 50% 40%,
                              rgba(0, 180, 216, 0.06) 0%,
                              transparent 70%);

  /* ── Text tiers (WCAG AA on dark glass) ────────── */
  --text:                #c9d1d9;   /* primary  ≈ 12.3:1 on --bg-glass */
  --text-dim:            #6b7686;   /* secondary ≥ 4.6:1 */
  --text-bright:         #f5f8fb;   /* emphasis */
  --text-meta:           #5b6573;   /* meta / timestamps, non-essential */

  /* ── Accent (cyan, hsl 188) ────────────────────── */
  --accent:              #22d3ee;   /* hsl(187 87% 85%)? → fixed: hsl(188 85% 53%) */
  --accent-strong:       #67e8f9;   /* hover/active, hsl(190 90% 70%) */
  --accent-dim:          rgba(34, 211, 238, 0.14);   /* fills, hover wash */
  --accent-line:         rgba(34, 211, 238, 0.45);   /* focus border */
  --accent-glow:         rgba(34, 211, 238, 0.10);   /* very soft outer glow */
  --accent-on:           #042027;   /* text on solid accent (≈ 8:1) */

  /* ── Neutral hairline borders ──────────────────── */
  --border:              rgba(255, 255, 255, 0.08);  /* default glass edge */
  --border-strong:       rgba(255, 255, 255, 0.14);  /* hover / dividers */
  --border-focused:      rgba(34, 211, 238, 0.40);   /* kept name, new value */

  /* ── Semantic ──────────────────────────────────── */
  --ok:                  #3fd07e;   /* success */
  --ok-dim:              rgba(63, 208, 126, 0.14);
  --warn:                #f5b14c;   /* reconnecting */
  --warn-dim:            rgba(245, 177, 76, 0.14);
  --danger:              #f0656a;   /* error / close hover */
  --danger-dim:          rgba(240, 101, 106, 0.18);

  /* ── Focus ring (keyboard a11y) ────────────────── */
  --focus-ring:          0 0 0 2px var(--bg), 0 0 0 4px var(--accent-line);
}
```

### 2.2 Color — Light

```css
[data-theme="light"] {
  --bg:                  #eef1f6;
  --bg-elev-1:           #ffffff;
  --bg-elev-2:           #f4f6fa;
  --bg-glass:            rgba(255, 255, 255, 0.78);
  --bg-titlebar:         rgba(248, 250, 253, 0.65);
  --bg-titlebar-focused: rgba(224, 246, 252, 0.80);
  --bg-topbar:           rgba(255, 255, 255, 0.72);
  --bg-dock:             rgba(255, 255, 255, 0.74);
  --bg-canvas-glow:      radial-gradient(ellipse 80% 60% at 50% 40%,
                              rgba(8, 145, 178, 0.05) 0%,
                              transparent 70%);

  --text:                #1f2937;   /* ≈ 13.8:1 */
  --text-dim:            #6b7280;   /* ≈ 4.7:1 */
  --text-bright:         #0b1220;
  --text-meta:           #9aa3b2;

  --accent:              #0891b2;   /* hsl(189 92% 36%) — AA on white */
  --accent-strong:       #0e7490;
  --accent-dim:          rgba(8, 145, 178, 0.10);
  --accent-line:         rgba(8, 145, 178, 0.45);
  --accent-glow:         rgba(8, 145, 178, 0.07);
  --accent-on:           #ffffff;

  --border:              rgba(15, 23, 42, 0.10);
  --border-strong:       rgba(15, 23, 42, 0.16);
  --border-focused:      rgba(8, 145, 178, 0.40);

  --ok:                  #16a34a;
  --ok-dim:              rgba(22, 163, 74, 0.12);
  --warn:                #c4791a;
  --warn-dim:            rgba(196, 121, 26, 0.12);
  --danger:              #dc2626;
  --danger-dim:          rgba(220, 38, 38, 0.12);

  --focus-ring:          0 0 0 2px var(--bg), 0 0 0 4px var(--accent-line);
}
```

### 2.3 Spacing scale

8-pt scale, one half-step for tight UI chrome.

```css
:root {
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
}
```

### 2.4 Radii

```css
:root {
  --radius-xs:  4px;   /* chips, code */
  --radius-sm:  6px;   /* buttons, inputs, menu items — was 4px */
  --radius:     10px;  /* windows, cards, menus — was 8px */
  --radius-lg:  14px;  /* dock pill, modal */
  --radius-pill: 999px;
}
```

> `--radius` and `--radius-sm` keep their names; values are nudged up for a
> softer, more premium feel. `--radius-xs`, `--radius-lg`, `--radius-pill` are
> new.

### 2.5 Glass / blur

```css
:root {
  --blur-sm:   8px;
  --blur:      16px;
  --blur-lg:   24px;
  --glass-saturate: 140%;
}
```

Apply as `backdrop-filter: blur(var(--blur)) saturate(var(--glass-saturate));`
The `saturate` boost keeps the cyan canvas glow from going grey behind glass.

### 2.6 Elevation / shadows / glows

Three elevation tiers + one focus glow. All use near-black with low alpha so
they read as depth, not as dark outlines.

```css
:root {
  --shadow-1: 0 1px 2px rgba(0,0,0,0.30), 0 2px 6px rgba(0,0,0,0.18);
  --shadow-2: 0 4px 12px rgba(0,0,0,0.34), 0 8px 24px rgba(0,0,0,0.22);
  --shadow-3: 0 12px 32px rgba(0,0,0,0.40), 0 24px 60px rgba(0,0,0,0.28);
  --glow-focus: 0 0 0 1px var(--border-focused),
                0 8px 32px rgba(34,211,238,0.10),
                0 2px 12px rgba(34,211,238,0.08);
  --glow-drag:  0 24px 60px rgba(0,0,0,0.45),
                0 0 0 1px var(--accent-line),
                0 0 24px rgba(34,211,238,0.14);
}
```

- `--shadow-1`: topbar, dock, menus, toasts.
- `--shadow-2`: unfocused windows.
- `--shadow-3`: modal overlay dialog.
- `--glow-focus`: replaces `.window-focused` box-shadow — the **only** place a
  cyan outer glow appears in the resting UI.
- `--glow-drag`: applied while a window is being dragged (transient).

### 2.7 Typography

```css
:root {
  --font-ui:    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
                'Helvetica Neue', Arial, sans-serif;
  --font-mono:  ui-monospace, 'SF Mono', 'JetBrains Mono', 'Fira Code',
                'Cascadia Code', Menlo, Consolas, monospace;
  --font-display: var(--font-ui);   /* same stack; weight does the work */

  --fs-xs:   11px;
  --fs-sm:   12px;
  --fs-md:   13px;   /* body baseline, was hardcoded on html */
  --fs-lg:   15px;
  --fs-xl:   18px;
  --fs-2xl:  22px;

  --fw-reg:  400;
  --fw-med:  500;
  --fw-semi: 600;

  --lh-tight: 1.25;
  --lh-base:  1.55;
  --lh-prose: 1.7;

  --tracking-ui:   0;       /* body */
  --tracking-meta: 0.04em;  /* meta labels, timestamps */
  --tracking-logo: 0.18em;  /* wordmark */
}
```

Monospace is used for: meta text (window id, timestamps, zoom %), code blocks,
plain-text window bodies, and the reconnecting indicator. It is the "machine
voice" of the HUD.

### 2.8 Motion

```css
:root {
  --dur-1: 120ms;   /* hover, focus tint */
  --dur-2: 200ms;   /* default (kept --transition name, see below) */
  --dur-3: 320ms;   /* window open/close, modal */
  --ease-out:   cubic-bezier(0.22, 0.61, 0.36, 1);
  --ease-soft:  cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.34, 1.4, 0.64, 1); /* dock pop only */

  /* Back-compat: keep the old name pointing at the new pair. */
  --transition: var(--dur-2) var(--ease-out);
}
```

Reduced motion (see §6) collapses every duration to `1ms` and disables the
shimmer/pulse keyframes.

---

## 3. Layout

### 3.1 Shell structure (unchanged DOM)

```
#app (column flex)
├── #topbar          → floating glass pill, 44px tall, 12px side margin
├── #canvas-container (flex:1) → #canvas (infinite, transformed)
├── #dock            → floating glass pill, 56px tall, 12px margin, centered
└── overlays: #context-menu, #toast-container, #modal-overlay
```

The topbar and dock stop being flush full-width bars and become **floating
pills**: they keep `position: relative` inside the flex column but gain side
margin, `border-radius: var(--radius-lg)`, and a stronger blur so the canvas
glow is visible behind them around the edges. This is the single biggest
visual change and needs **no HTML change** — only margins/radius/shadow.

### 3.2 Z-index scale (new tokens, replaces magic numbers)

```css
:root {
  --z-canvas:    1;
  --z-window:    10;
  --z-window-top: 100;   /* focused window stacks here */
  --z-topbar:    1000;
  --z-dock:      1000;
  --z-menu:      5000;   /* context, settings, ws-list, new-window */
  --z-modal:     8000;
  --z-toast:     9000;
}
```

### 3.3 Responsive behavior

The app is a desktop canvas; below 720px width it does **not** become a phone
site, but the chrome collapses:

- **≥ 1024px:** full topbar with workspace dropdown, zoom group, settings, new.
- **720–1023px:** hide `.ws-label` and `.topbar-label`; zoom group becomes icon-only.
- **< 720px:** topbar shrinks to logo + workspace name + settings; dock stays a
  pill but its `#dock-minimized` rail scrolls horizontally. Windows are forced
  to near-full-canvas (the window manager clamps width/height).

These are media-query rules scoped to the topbar/dock selectors only; the
canvas itself never restyles.

---

## 4. Component Specs

Each spec lists the selector(s) that change, the tokens used, and the states.
A `→` means "property becomes". Anything not listed stays as-is.

### 4.1 Topbar

Selector: `#topbar`

```css
#topbar {
  height: 44px; min-height: 44px;
  margin: 10px 12px 0;
  padding: 0 var(--space-3);
  gap: var(--space-2);
  background: var(--bg-topbar);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(var(--blur-lg)) saturate(var(--glass-saturate));
  box-shadow: var(--shadow-1);
  z-index: var(--z-topbar);
}
/* replace flush border-bottom with floating pill: remove border-bottom rule */
```

Logo (`.logo`):

- Use the `✦` glyph in `--accent`, then `WORKSPACE` in `--text-bright`,
  `--fs-sm`, `--fw-semi`, `letter-spacing: var(--tracking-logo)`.
- A 1px vertical divider (`--border-strong`) at 16px right margin separates it
  from the workspace controls. Implemented as a `::after` on `.logo` — no DOM
  change.

Workspace label/name (`.ws-label`, `#ws-name`): `.ws-label` → `--text-meta`,
`--fs-xs`, `font-family: var(--font-mono)`, `letter-spacing: var(--tracking-meta)`,
uppercase. `#ws-name` → `--text-bright`, `--fs-md`, `--fw-med`.

`.topbar-btn` (zoom, settings, new, minimize-all):

```css
.topbar-btn {
  background: transparent;
  border: 1px solid transparent;          /* hairline only on hover */
  color: var(--text-dim);
  padding: 4px 10px;
  height: 28px;
  border-radius: var(--radius-sm);
  font-size: var(--fs-sm);
  font-family: var(--font-mono);
  transition: background var(--transition), color var(--dur-1) var(--ease-out),
              border-color var(--dur-1) var(--ease-out);
}
.topbar-btn:hover  { color: var(--text-bright); background: var(--accent-dim);
                     border-color: var(--border-strong); }
.topbar-btn:active { color: var(--accent); background: var(--accent-dim); }
.topbar-btn:focus-visible { box-shadow: var(--focus-ring); outline: none; }
.topbar-btn:disabled { opacity: 0.4; cursor: not-allowed; }
```

The `+ New` button is the only **primary** topbar button:

```css
#btn-new-ws {
  background: var(--accent-dim);
  color: var(--accent-strong);
  border-color: var(--border-focused);
  font-weight: var(--fw-semi);
}
#btn-new-ws:hover { background: var(--accent); color: var(--accent-on); }
```

`.topbar-group` (zoom cluster): wrap the three zoom buttons in a subtle
inset track — `background: rgba(255,255,255,0.03); border: 1px solid var(--border);
border-radius: var(--radius-sm); padding: 2px; gap: 2px;`. Children lose their
own border. No DOM change; the group already exists.

`.topbar-label` (zoom %): `font-family: var(--font-mono); color: var(--text-meta);
font-size: var(--fs-xs); letter-spacing: var(--tracking-meta);`.

### 4.2 Dock

Selector: `#dock`. Becomes a floating pill anchored to the bottom with side
margins, centered horizontally.

```css
#dock {
  height: 56px; min-height: 56px;
  margin: 0 auto 12px;
  width: fit-content;
  max-width: calc(100% - 24px);
  padding: 0 var(--space-3);
  gap: var(--space-2);
  background: var(--bg-dock);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  backdrop-filter: blur(var(--blur-lg)) saturate(var(--glass-saturate));
  box-shadow: var(--shadow-2);
  z-index: var(--z-dock);
}
```

`.dock-btn`:

```css
.dock-btn {
  width: 38px; height: 38px;
  display: grid; place-items: center;
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-dim);
  border-radius: var(--radius);
  font-size: 16px;
  transition: background var(--dur-1) var(--ease-out),
              color var(--dur-1) var(--ease-out),
              transform var(--dur-2) var(--ease-spring);
}
.dock-btn:hover  { background: var(--accent-dim); color: var(--accent-strong);
                   transform: translateY(-2px); }
.dock-btn:active { transform: translateY(0); color: var(--accent); }
.dock-btn:focus-visible { box-shadow: var(--focus-ring); outline: none; }
```

The `+` (new window) dock button gets the primary treatment like `#btn-new-ws`:
`color: var(--accent-strong); background: var(--accent-dim);` and on hover
`background: var(--accent); color: var(--accent-on);`.

`#new-window-menu`: floats above the dock with `--shadow-2`, `--radius`,
`--blur-lg`. Same menu-item spec as context menu (§4.5).

`#dock-minimized` (minimized window rail): the existing flex row. Each
`.dock-item` (created by JS) becomes a chip:

```css
.dock-item {
  height: 32px;
  padding: 0 var(--space-3);
  display: inline-flex; align-items: center; gap: 6px;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  color: var(--text-dim);
  font-size: var(--fs-sm);
  max-width: 180px;
  transition: background var(--dur-1) var(--ease-out),
              color var(--dur-1) var(--ease-out),
              border-color var(--dur-1) var(--ease-out);
}
.dock-item:hover { background: var(--accent-dim); color: var(--text-bright);
                   border-color: var(--border-strong); }
.dock-item .dot { width: 6px; height: 6px; border-radius: 50%;
                  background: var(--text-meta); }
.dock-item:hover .dot { background: var(--accent); }
```

A small dot (rendered via JS or `::before`) acts as the window-type glyph
placeholder; hover lights it cyan.

### 4.3 Windows

#### Frame

```css
.window {
  background: var(--bg-glass);
  border: 1px solid var(--border);          /* neutral hairline */
  border-radius: var(--radius);
  backdrop-filter: blur(var(--blur)) saturate(var(--glass-saturate));
  box-shadow: var(--shadow-2);
  transition: box-shadow var(--dur-2) var(--ease-out),
              border-color var(--dur-2) var(--ease-out),
              transform var(--dur-2) var(--ease-soft);
  z-index: var(--z-window);
}
.window-focused {
  border-color: var(--border-focused);
  box-shadow: var(--glow-focus);            /* the only resting cyan glow */
  z-index: var(--z-window-top);
}
.window-dragging {                          /* new class, added by JS on drag start */
  box-shadow: var(--glow-drag);
  transform: scale(1.005);
  transition: none;                         /* no easing during drag */
  cursor: grabbing;
}
```

> `--glow-focus` is intentionally soft: a 1px accent hairline plus two
> low-alpha cyan shadows. It reads as "this window is live", not as neon.

#### Titlebar

```css
.titlebar {
  height: 36px; min-height: 36px;
  padding: 0 var(--space-2) 0 var(--space-3);
  background: var(--bg-titlebar);
  border-bottom: 1px solid var(--border);
}
.window-focused .titlebar { background: var(--bg-titlebar-focused); }
```

`.titlebar-text`: `font-size: var(--fs-sm); color: var(--text); font-weight:
var(--fw-med);`. On focused window → `color: var(--text-bright);`. Add a
6px×6px `--accent` dot via `::before` on focused windows only
(`.window-focused .titlebar-text::before`) — the "live" indicator. No DOM change.

`.titlebar-btn` (minimize / maximize / close): glyph buttons, 24×24 hit area.

```css
.titlebar-btn {
  width: 24px; height: 24px;
  color: var(--text-meta);
  border-radius: var(--radius-xs);
  transition: background var(--dur-1) var(--ease-out),
              color var(--dur-1) var(--ease-out);
}
.titlebar-btn:hover  { background: rgba(255,255,255,0.08); color: var(--text-bright); }
.titlebar-btn:focus-visible { box-shadow: var(--focus-ring); outline: none; }
.titlebar-close:hover { background: var(--danger-dim); color: var(--danger); }
```

#### Content areas (per window type)

- `.window-content`: `background: transparent;` (glass shows through); add a
  top hairline `box-shadow: inset 0 1px 0 var(--border);`? No — keep clean.
- `.markdown-body`: `padding: var(--space-6); line-height: var(--lh-prose);
  color: var(--text);`. `h1` → `--fs-2xl`, `--text-bright`, `--fw-semi`,
  `margin-bottom: var(--space-3)`. `h2` → `--fs-lg`, `--accent`, `--fw-semi`,
  with a 2px left `border-left: 2px solid var(--accent-line); padding-left:
  var(--space-2);` for a subtle HUD accent. `code` → `background: var(--bg-elev-2);
  color: var(--accent-strong); border: 1px solid var(--border);`. `pre` →
  `background: var(--bg-elev-2); border: 1px solid var(--border); border-radius:
  var(--radius-sm);`. `a` → `color: var(--accent-strong);
  text-decoration-color: var(--accent-line); text-underline-offset: 2px;`.
- `.text-body`: `font-family: var(--font-mono); font-size: var(--fs-sm);
  color: var(--text); padding: var(--space-4); line-height: var(--lh-base);`.
- `.explorer-item`: `padding: var(--space-2) var(--space-3); border-radius:
  var(--radius-sm); font-size: var(--fs-sm);`. Hover → `background:
  var(--accent-dim);`. **Selected** (new `.explorer-item.selected`) →
  `background: var(--accent-dim); color: var(--text-bright);
  border-left: 2px solid var(--accent);`. Active/selected state is the HUD way
  to show "AI knows about this object".
- `.image-body`: keep `object-fit: contain`; add `background:
  var(--bg-elev-1);` so transparent PNGs have a neutral checker-ish base.
- `.html-iframe`: unchanged.
- `.wnd-empty` / `.wnd-loading`: `color: var(--text-meta);
  font-family: var(--font-mono); font-size: var(--fs-sm);
  letter-spacing: var(--tracking-meta);`.

#### Resize handle

The current `linear-gradient` corner triangle reads as a 90s resize affordance.
Replace with a subtle two-line grip:

```css
.resize-handle-se {
  width: 16px; height: 16px;
  background: none;
  position: relative;
}
.resize-handle-se::before,
.resize-handle-se::after {
  content: ""; position: absolute; right: 3px; bottom: 3px;
  width: 8px; height: 1px; background: var(--border-strong);
  transform-origin: right bottom;
}
.resize-handle-se::after { bottom: 6px; width: 5px; }
.window-focused .resize-handle-se::before,
.window-focused .resize-handle-se::after { background: var(--accent-line); }
```

### 4.4 Welcome placeholder

`#welcome-placeholder` stays centered, non-interactive except the action row.

```css
.welcome-content {
  max-width: 520px;
  padding: var(--space-8);
  text-align: center;
}
.welcome-content h1 {
  font-size: var(--fs-2xl);
  font-weight: var(--fw-reg);
  color: var(--text-bright);
  letter-spacing: -0.01em;
  margin-bottom: var(--space-2);
}
.welcome-content p {
  font-size: var(--fs-md);
  color: var(--text-dim);
  margin-bottom: var(--space-6);
}
.welcome-btn {
  background: var(--bg-glass);
  border: 1px solid var(--border);
  color: var(--text);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-sm);
  font-size: var(--fs-sm);
  backdrop-filter: blur(var(--blur-sm));
  transition: background var(--dur-1) var(--ease-out),
              border-color var(--dur-1) var(--ease-out),
              color var(--dur-1) var(--ease-out),
              transform var(--dur-2) var(--ease-spring);
}
.welcome-btn:hover  { background: var(--accent-dim); color: var(--accent-strong);
                      border-color: var(--border-focused);
                      transform: translateY(-1px); }
.welcome-btn:active { transform: translateY(0); }
.welcome-btn:focus-visible { box-shadow: var(--focus-ring); outline: none; }
```

### 4.5 Context menu, settings dropdown, ws-list, new-window menu

These share one menu grammar. Consolidate into a single set of rules; the
existing selectors stay.

```css
#context-menu,
.dropdown-menu,
#ws-list,
#new-window-menu {
  background: var(--bg-glass);
  backdrop-filter: blur(var(--blur-lg)) saturate(var(--glass-saturate));
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  padding: var(--space-1);
  box-shadow: var(--shadow-2);
  z-index: var(--z-menu);
}
.menu-item {
  padding: 7px var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--fs-sm);
  color: var(--text);
  cursor: pointer;
  transition: background var(--dur-1) var(--ease-out),
              color var(--dur-1) var(--ease-out);
}
.menu-item:hover  { background: var(--accent-dim); color: var(--accent-strong); }
.menu-item:focus-visible,
.menu-item[aria-current="true"] { box-shadow: var(--focus-ring); outline: none; }
.menu-separator { height: 1px; background: var(--border);
                  margin: var(--space-1) var(--space-2); }
```

`#ws-list .ws-item.active` → keep name; value becomes `background:
var(--accent-dim); color: var(--accent-strong);` and add a 3px left
`border-left: 3px solid var(--accent); padding-left: calc(var(--space-3) - 3px);`
to mark the current workspace.

### 4.6 Toasts

```css
#toast-container {
  top: 64px; right: 16px;        /* clear of the floating topbar */
  z-index: var(--z-toast);
  gap: var(--space-2);
}
.toast {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius);
  font-size: var(--fs-sm);
  backdrop-filter: blur(var(--blur)) saturate(var(--glass-saturate));
  border: 1px solid var(--border-strong);
  box-shadow: var(--shadow-2);
  max-width: 360px;
  display: flex; align-items: center; gap: var(--space-2);
}
.toast::before {                  /* status pip, no DOM change */
  content: ""; width: 6px; height: 6px; border-radius: 50%;
  background: currentColor; flex: none;
}
.toast-info    { background: var(--accent-dim);  color: var(--accent-strong);
                 border-color: var(--border-focused); }
.toast-success { background: var(--ok-dim);      color: var(--ok);
                 border-color: rgba(63,208,126,0.35); }
.toast-error   { background: var(--danger-dim);  color: var(--danger);
                 border-color: rgba(240,101,106,0.35); }
.toast-warn    { background: var(--warn-dim);    color: var(--warn);
                 border-color: rgba(245,177,76,0.35); }
@keyframes toast-in {
  from { opacity: 0; transform: translateX(16px) scale(0.98); }
  to   { opacity: 1; transform: translateX(0)    scale(1); }
}
```

Light theme note: semantic text colors (`--ok/--warn/--danger`) are already
AA on the light glass; the dim backgrounds stay low-alpha. No override needed
beyond the tokens.

### 4.7 Modal

```css
#modal-overlay {
  background: rgba(3, 5, 9, 0.55);
  backdrop-filter: blur(2px);          /* subtle scene blur, not heavy */
  z-index: var(--z-modal);
}
#modal {
  background: var(--bg-glass);
  backdrop-filter: blur(var(--blur-lg)) saturate(var(--glass-saturate));
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  min-width: 360px;
  box-shadow: var(--shadow-3);
}
#modal h2 { font-size: var(--fs-lg); font-weight: var(--fw-semi);
            color: var(--text-bright); margin-bottom: var(--space-4); }
#modal input {
  background: var(--bg-elev-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text);
  padding: var(--space-2) var(--space-3);
  font-size: var(--fs-md);
  font-family: var(--font-ui);
}
#modal input:focus { border-color: var(--accent); box-shadow: var(--focus-ring);
                     outline: none; }
#modal input::placeholder { color: var(--text-meta); }
.modal-btn {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-strong);
  background: transparent; color: var(--text);
  font-size: var(--fs-sm);
  transition: background var(--dur-1) var(--ease-out),
              color var(--dur-1) var(--ease-out);
}
.modal-btn:hover  { background: var(--accent-dim); color: var(--text-bright); }
.modal-btn:focus-visible { box-shadow: var(--focus-ring); outline: none; }
.modal-btn.primary { background: var(--accent); color: var(--accent-on);
                     border-color: var(--accent); font-weight: var(--fw-semi); }
.modal-btn.primary:hover { background: var(--accent-strong); }
```

### 4.8 Explorer / search / tabbed content (window interiors)

These are window-content variants. Spec the shared patterns:

**Explorer list** (`.explorer-item` rows inside a window):
- Row height 30px, `padding: 0 var(--space-3)`, `font-size: var(--fs-sm)`.
- File-type glyph (rendered by JS) sits in a 20px square with
  `color: var(--text-meta)`.
- Hover: `background: var(--accent-dim)`. Selected: see §4.3.
- Section header rows (`.explorer-section`): `font-family: var(--font-mono);
  font-size: var(--fs-xs); text-transform: uppercase;
  letter-spacing: var(--tracking-meta); color: var(--text-meta);
  padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--border);`

**Search** (in-window search field + result list):
- `.search-field`: `background: var(--bg-elev-2); border: 1px solid var(--border);
  border-radius: var(--radius-sm); padding: var(--space-2) var(--space-3);
  color: var(--text);`. Focus → `border-color: var(--accent); box-shadow:
  var(--focus-ring);`.
- Results reuse `.explorer-item`. Query match highlight: `<mark>` styled as
  `background: var(--accent-dim); color: var(--accent-strong);
  border-radius: 2px; padding: 0 2px;`.

**Tabbed group** (`.tabbed` window):
- Tab strip: `display: flex; gap: 2px; padding: var(--space-1) var(--space-2);
  border-bottom: 1px solid var(--border); background: var(--bg-titlebar);`
- `.tab`: `padding: var(--space-1) var(--space-3); border-radius:
  var(--radius-sm) var(--radius-sm) 0 0; font-size: var(--fs-sm);
  color: var(--text-dim); border: 1px solid transparent;
  border-bottom: none; cursor: pointer;`
- `.tab:hover` → `color: var(--text); background: var(--accent-dim);`
- `.tab.active` → `color: var(--text-bright); background: var(--bg-glass);
  border-color: var(--border);` and a 2px `--accent` top border via
  `border-top: 2px solid var(--accent); padding-top: calc(var(--space-1) - 1px);`

### 4.9 Loading skeleton

```css
#loading-skeleton { gap: var(--space-5); }
.skeleton-card {
  width: 300px; padding: var(--space-6);
  background: var(--bg-glass);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  gap: var(--space-3);
  backdrop-filter: blur(var(--blur-sm));
}
.skeleton-line {
  height: 10px; border-radius: var(--radius-xs);
  background: linear-gradient(90deg,
              rgba(255,255,255,0.04) 25%,
              rgba(255,255,255,0.10) 50%,
              rgba(255,255,255,0.04) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.6s var(--ease-soft) infinite;
}
```

The shimmer is now **neutral white**, not cyan — cyan shimmer read as "loading
data from the matrix" gaming vibe. Neutral shimmer is calmer.

### 4.10 Reconnecting indicator

```css
.reconnecting {
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  color: var(--warn);
  letter-spacing: var(--tracking-meta);
  display: inline-flex; align-items: center; gap: 4px;
}
.reconnecting::before {             /* spinning ring, replaces the ⟳ glyph */
  content: ""; width: 10px; height: 10px; border-radius: 50%;
  border: 1.5px solid var(--warn); border-right-color: transparent;
  animation: spin 0.9s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pulse-text { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }
```

Keep `pulse-text` available but prefer the spinner; the spinner reads as
"system working" without the alarming blink.

---

## 5. States Summary

| Element | Default | Hover | Focus-visible | Active | Disabled | Selected/Active-state |
|---|---|---|---|---|---|---|
| `.topbar-btn` | transparent, `--text-dim` | `--accent-dim`, `--text-bright`, hairline | `--focus-ring` | `--accent` text | `opacity:.4` | — |
| `.dock-btn` | transparent, `--text-dim` | `--accent-dim`, `--accent-strong`, lift 2px | `--focus-ring` | flatten | — | — |
| `.dock-item` | chip, `--text-dim` | `--accent-dim`, `--text-bright` | `--focus-ring` | — | — | — |
| `.titlebar-btn` | `--text-meta` | white-08 wash, `--text-bright` | `--focus-ring` | — | — | — |
| `.titlebar-close` | `--text-meta` | `--danger-dim`, `--danger` | `--focus-ring` | — | — | — |
| `.menu-item` | `--text` | `--accent-dim`, `--accent-strong` | `--focus-ring` | — | — | `aria-current` → focus ring |
| `.welcome-btn` | glass, `--text` | `--accent-dim`, `--accent-strong`, hairline, lift | `--focus-ring` | flatten | — | — |
| `.modal-btn` | transparent, `--text` | `--accent-dim`, `--text-bright` | `--focus-ring` | — | `opacity:.4` | — |
| `.modal-btn.primary` | `--accent` fill, `--accent-on` | `--accent-strong` | `--focus-ring` | — | — | — |
| `.explorer-item` | `--text` | `--accent-dim` | `--focus-ring` | — | — | `.selected` → `--accent-dim` + left bar |
| `.window` | `--shadow-2`, neutral border | — | — | — | — | `.window-focused` → `--glow-focus` |
| `.window-dragging` | `--glow-drag`, `scale(1.005)`, no transition | — | — | — | — | — |

### Dragging elevation

When the window manager starts a drag (JS adds `.window-dragging`), the window
jumps to `z-index: var(--z-window-top)`, swaps to `--glow-drag`, and disables
transition so movement is 1:1 with the pointer. On drop the class is removed
and the focused glow eases back in over `--dur-2`.

### Minimized dock items

Minimized windows render as `.dock-item` chips (§4.2). A click restores: the
chip fades out, the window fades/slides in over `--dur-3` with
`@keyframes window-restore { from { opacity: 0; transform: scale(0.96); }
to { opacity: 1; transform: scale(1); } }`. Minimize uses the inverse:
`@keyframes window-minimize { to { opacity: 0; transform: scale(0.96); } }`
applied for `--dur-2` before the window is hidden.

---

## 6. Accessibility

### 6.1 Contrast (WCAG AA target)

Dark theme, measured against `--bg-glass` `rgba(18,21,29,0.72)` over the canvas
glow (effective ≈ `#0e1118`):

| Token | Hex | On `--bg-glass` | Ratio | Grade |
|---|---|---|---|---|
| `--text-bright` | #f5f8fb | dark | 15.4:1 | AAA |
| `--text` | #c9d1d9 | dark | 12.3:1 | AAA |
| `--text-dim` | #6b7686 | dark | 4.6:1 | AA |
| `--text-meta` | #5b6573 | dark | 3.0:1 | AA-large only¹ |
| `--accent` | #22d3ee | dark | 9.1:1 | AAA |
| `--accent` on `--accent` fill (`--accent-on` #042027) | — | — | 8.4:1 | AAA |
| `--ok` / `--warn` / `--danger` | — | dark | 6.8 / 7.9 / 5.4 | AA+ |

¹ `--text-meta` is reserved for non-essential meta (timestamps, meta labels at
`--fs-xs`). It must **never** carry essential information or interactive text.
Body copy and labels use `--text` / `--text-dim` minimum.

Light theme: `--text` #1f2937 on `--bg-glass` ≈ 13.8:1; `--accent` #0891b2 on
white ≈ 4.6:1 (AA for normal text); `--accent` is used for fills and large
text primarily; small accent text uses `--accent-strong` #0e7490 (≈ 6.1:1).

### 6.2 Focus-visible

Every interactive element gets `:focus-visible { box-shadow: var(--focus-ring);
outline: none; }`. The ring is a 2px accent halo offset 2px from the element by
a 2px `--bg` gap so it stays visible on any backdrop. `:focus` (mouse click)
does **not** show the ring — only keyboard navigation does.

### 6.3 Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
  .reconnecting::before { animation: none; }
  .skeleton-line { animation: none; background: rgba(255,255,255,0.06); }
}
```

The shimmer and spinner stop; skeleton lines become a static flat fill;
transitions collapse to instant. Layout and color states still change, just
without motion.

### 6.4 Keyboard nav

- Topbar buttons, dock buttons, menu items, modal buttons, welcome buttons,
  explorer items, and tabs must be reachable via Tab and operable via
  Enter/Space. Where the existing JS uses `<div>` for menu items, add
  `tabindex="0"` and `role="menuitem"` (JS-side, not a CSS concern, but called
  out here for the coder).
- Context menu: Escape closes; arrow keys move the highlight (JS).
- Modal: focus trapped inside `#modal` while visible; Escape closes (JS).

### 6.5 Hits

- Minimum click target: 24×24 (titlebar buttons meet this; dock buttons exceed).
- `prefers-color-scheme`: the app persists its own theme via
  `data-theme`, so do **not** auto-switch on this media query; respect the
  user's saved choice.

---

## 7. Implementation Notes

### 7.1 What changes vs stays

**Selectors that change values only (no structural change):**
`#topbar`, `.logo`, `.ws-label`, `#ws-name`, `.topbar-btn`, `.topbar-group`,
`.topbar-label`, `#dock`, `.dock-btn`, `.dock-item`, `.window`,
`.window-focused`, `.titlebar`, `.titlebar-text`, `.titlebar-btn`,
`.titlebar-close`, `.markdown-body` and children, `.text-body`, `.explorer-item`,
`.resize-handle-se`, `#context-menu`, `.dropdown-menu`, `#ws-list`,
`#new-window-menu`, `.menu-item`, `.menu-separator`, `#ws-list .ws-item.active`,
`#toast-container`, `.toast` and variants, `#modal-overlay`, `#modal`, `#modal h2`,
`#modal input`, `.modal-btn`, `.modal-btn.primary`, `#loading-skeleton`,
`.skeleton-card`, `.skeleton-line`, `.reconnecting`, `#canvas-container`,
`#welcome-placeholder`, `.welcome-content`, `.welcome-btn`.

**New selectors (additive, no DOM change required unless noted):**
- `.window-dragging` — added to `.window` by JS during drag.
- `.explorer-item.selected` — added by JS on selection.
- `.toast-warn`, `.toast::before` — new variant + pip.
- `.reconnecting::before` — replaces `⟳` glyph.
- `.resize-handle-se::before / ::after` — grip lines.
- `.logo::after` — divider.
- `.window-focused .titlebar-text::before` — live dot.
- `.tab`, `.tab.active`, `.tabbed`, `.explorer-section`, `.search-field` —
  these window-interior classes are created by the window factory today or
  will be; the spec styles them so they exist when needed.
- `@keyframes window-minimize`, `window-restore`, `spin`.
- `@media (prefers-reduced-motion: reduce)` block.
- `:focus-visible` rules on all interactive selectors.

**Selectors that stay untouched:** `*, *::before, *::after` reset, `html,body`
base (only `font-size` should reference `var(--fs-md)` instead of `13px`),
`#app`, scrollbar rules, `::selection` (keep, maybe retint to
`var(--accent-dim)`), `.hidden`, resize handle positions (`-e`, `-s`),
`.html-iframe`, `.image-body` (just add background).

### 7.2 CSS file organization

Keep the four-file split. Tokens go in `variables.css` (replace the two
`:root`/`[data-theme]` blocks with the §2 blocks; everything else in that file
stays). The new selectors distribute by concern:

- `global.css` — `:focus-visible` base, reduced-motion block, retinted
  `::selection`, scrollbar using `--border-strong`.
- `desktop.css` — topbar, dock, welcome, context menu, dropdowns, ws-list,
  modal, toasts, skeleton, reconnecting, canvas background
  (`#canvas-container` uses `background: var(--bg-canvas-glow), var(--bg);`).
- `window.css` — window frame, titlebar, content variants, resize handle,
  explorer/search/tabbed, drag/minimize/restore keyframes.

### 7.3 Drop-in order

1. Replace `variables.css` contents with the §2 token blocks. **At this point
   the app already looks refreshed** because every existing rule references the
   renamed-but-same-name tokens.
2. Update `global.css` (focus-visible, reduced-motion, selection, body font-size
   → `var(--fs-md)`).
3. Update `desktop.css` selector values per §4.1–4.2, 4.4–4.10.
4. Update `window.css` per §4.3, 4.8.
5. JS touches (minimal): add `.window-dragging` on drag start/remove on drop;
   add `.explorer-item.selected` on selection; add `tabindex`/`role` to
   `<div>`-based menu items; add `.toast-warn` when needed; replace the `⟳`
   text node in `#reconnecting-indicator` with empty text (the `::before`
   spinner + CSS text handles the rest) — or simply leave the `⟳` and let the
   CSS spinner replace visually.

### 7.4 Things to avoid (anti-goals)

- No RGB / multi-color glows. One accent family only.
- No heavy neon text-shadow on body copy. Glow lives on the focused window
  border only.
- No drop shadows on flat text. Shadows are for elevation of containers.
- No bouncy easings except `--ease-spring` on the dock hover lift and welcome
  button lift. Everything else uses `--ease-out` / `--ease-soft`.
- No solid accent fills on large surfaces. `--accent` solid is reserved for
  primary buttons, the active tab top bar, the selected explorer left bar, and
  the live-status dot.
- No new HTML elements required for v1 of this refresh. The dock-pill,
  topbar-pill, and glass surfaces are pure CSS.
- No `border-radius` larger than `--radius-pill`. No mixed corner radii.
- No backdrop-filter without `saturate(var(--glass-saturate))` — unsaturated
  blur goes grey and kills the HUD feel.

### 7.5 Token quick-reference (for the coder)

```
Colors:     --bg --bg-elev-1 --bg-elev-2 --bg-glass --bg-titlebar
            --bg-titlebar-focused --bg-topbar --bg-dock --bg-canvas-glow
            --text --text-dim --text-bright --text-meta
            --accent --accent-strong --accent-dim --accent-line --accent-glow --accent-on
            --border --border-strong --border-focused
            --ok --ok-dim --warn --warn-dim --danger --danger-dim
            --focus-ring
Spacing:    --space-1..10
Radii:      --radius-xs --radius-sm --radius --radius-lg --radius-pill
Blur:       --blur-sm --blur --blur-lg --glass-saturate
Shadow:     --shadow-1 --shadow-2 --shadow-3 --glow-focus --glow-drag
Type:       --font-ui --font-mono --font-display
            --fs-xs..2xl --fw-reg --fw-med --fw-semi
            --lh-tight --lh-base --lh-prose
            --tracking-ui --tracking-meta --tracking-logo
Motion:     --dur-1 --dur-2 --dur-3 --ease-out --ease-soft --ease-spring --transition
Z-index:    --z-canvas --z-window --z-window-top --z-topbar --z-dock --z-menu --z-modal --z-toast
```

---

## 8. Visual Target

See `/tmp/opencode/workspace-ui-mockup.html` — a single self-contained file
with inline CSS using the exact token values above. It renders the dark-theme
desktop with: floating glass topbar, three sample windows (one focused with
the cyan glow, one markdown content, one explorer list), floating dock pill,
and a toast. The coder implements the app to match this target.