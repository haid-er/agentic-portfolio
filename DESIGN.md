# DESIGN.md: Ground Truth Press

This file is binding for every builder. It defines two named themes, **Almanac** (reads light) and **Strata** (reads dark), which share one layout.
Where this file and a concept mock disagree, this file wins. Facts shown on the site come only from `content/` (seeded from `docs/context/`). Nothing in this file is a fact source.

---

## 0. Verdict (design panel)

| Concept | Memorability | Fit to story | Readability / a11y | Mobile | Feasibility (CSS/SVG/canvas) | Total |
|---|---|---|---|---|---|---|
| 1. Signal: Strip Chart / Phosphor | 9 | 7 | 7 | 8 | 8 | 39 |
| 2. Message Schematic: Vellum / Switchboard | 7 | 8 | 6 | 5 | 8 | 34 |
| **3. Ground Truth Press: Almanac / Strata** | **9** | **9** | **8** | **8** | **8** | **42** |

**Winner: Concept 3, Ground Truth Press.** It is the only concept that tells the whole career. The core-sample plate turns his path (PUCIT, first C/C++ repos, Webox/VoodVR, MotionIQ, Piron Labs, Euthyna) into one object, and each layer links to a demo. That object *is* the product promise ("proves instead of claims"). It also puts his current domain (ESG/GHG at Euthyna) first and uses his graphic-design credit as the craft of the page, not as decoration. It is the only concept whose hero number is live and real: UK grid carbon intensity. The two worlds are really different, with different type families, radii, textures and motion.

What the runners-up did better, and what this file grafts in (marked **[graft C1]** / **[graft C2]** below):
- **C1 Signal**: the most striking single effect (the live IMU trace), a bottom tab bar on mobile, icons that are waveforms, accuracy meters, the View Transitions API with a real fallback, a tokens panel that reads the live CSS, and a still frame under reduced motion. It was not chosen because it pins a full-stack engineer to one student-research thread. It also listed co-author names, which breaks the "no colleague names" rule.
- **C2 Message Schematic**: per-role header lines with several "proves" chips, a hover where a packet travels along the skill-to-demo cable, the engineering title block as a footer, 44px routing-table rows, and contrast computed for every pair. It was not chosen because the hero diagram becomes unreadable at 390px, the chip row runs off-screen on mobile, `ink-3` on `bg-2` is 4.42:1 (fails AA), and the mid-switch frame is a flat dark screen.

Fixes applied to the winner (contrast recomputed with the WCAG 2.x formula, script in the design review):
- Almanac vermilion `#D2462A` is 3.78:1, so it is used **only** for decoration, for text of 24px or larger, and for graphics. Small red text uses `--accent-ink #9E2F16` (6.12:1).
- Strata `--rule` goes from `#6B5A48` (2.84:1, below the 3:1 needed for component boundaries) to `#8A7560` (4.28:1 on bg, 3.83:1 on surface).
- A tertiary text token is added to both themes and checked on every surface.
- The transition now reveals the **real new page** under the ink bands, instead of covering it with a solid colour.

---

## 1. Concept in one paragraph

The portfolio is printed matter about the earth. Malik writes software for the ground under our feet (sustainability reporting, GHG calculations and climate risk at Euthyna). Before that he built sensor pipelines for activity-recognition research, and he holds a Best Graphic Designer credit from PUCIT. The site is one publication printed twice. **Almanac** is a risograph field almanac on uncoated cream stock. **Strata** is a soil core read under a field lamp. The recurring device is the **core sample**: work drawn as sediment, newest on top, each layer a link to the playground demo that proves it. Every claim ends in a "Proof: demo-slug" link.

---

## 2. Themes and tokens

Implementation:
- Tokens are CSS custom properties on `[data-theme="almanac"]` and `[data-theme="strata"]`, set on `<html>`. `:root` falls back to Almanac.
- Tokens are scoped to the attribute, not to `:root` only. Any subtree can render the other world (theme-lab previews, specimen cards) **[graft C1]**.
- Tailwind reads the tokens through `theme.extend` (`colors: { bg: 'var(--bg)', ... }`). Do not hard-code hex values in components.
- Admin stores both themes in `content/theme.json` (shape in 2.4). The build writes them into `app/globals.css` defaults. Admin can rename each theme (`label`) and retune any token. The theme-lab demo checks contrast live and refuses to save a text pair below 4.5:1, or a UI or graphic pair below 3:1.

### 2.1 Almanac (reads light): risograph field almanac

```css
[data-theme="almanac"] {
  color-scheme: light;

  /* colour: contrast ratios are WCAG 2.x, computed */
  --bg:          #F2EADB;  /* uncoated cream stock */
  --bg-2:        #E9DEC9;  /* inset sheet, section bands */
  --surface:     #F7F1E6;  /* cards, plate */
  --ink:         #1D2B22;  /* spruce-black   12.4:1 bg | 13.2:1 surface */
  --ink-2:       #4A5448;  /* secondary       6.6:1 bg |  5.9:1 bg-2 */
  --ink-3:       #5A6356;  /* meta, folios    5.2:1 bg |  4.7:1 bg-2 */
  --accent:      #1F6B47;  /* riso green      5.4:1 bg |  4.8:1 bg-2 | 5.7:1 surface */
  --accent-2:    #D2462A;  /* riso vermilion  3.8:1: DECORATIVE, >=24px text, graphics only */
  --accent-ink:  #9E2F16;  /* vermilion for small text  6.1:1 bg | 5.5:1 bg-2 */
  --on-accent:   #F7F1E6;  /* text on --accent 5.7:1, on --ink 13.2:1, on --accent-ink 6.5:1 */
  --rule:        #1D2B22;  /* hairlines AND control borders (>=3:1) */
  --rule-soft:   rgba(29,43,34,.22);  /* decorative dividers only, never a control edge */
  --focus:       #1F6B47;  /* 2px outline + 2px offset */
  --ok:          #1F6B47;
  --warn:        #7A5300;  /* 5.7:1 bg */
  --danger:      #9E2F16;
  --data-1:      #1F6B47;  /* chart inks: green, vermilion, ochre-brown, ink */
  --data-2:      #D2462A;  /* 3.8:1 graphics OK */
  --data-3:      #8F6414;  /* 4.4:1 */
  --data-4:      #1D2B22;
  --halftone:    rgba(31,107,71,.9);
  --overprint:   rgba(210,70,42,.85);
  --layer-1: var(--accent);  --layer-2: var(--accent-2);  --layer-3: var(--accent);
  --layer-4: var(--accent-2); --layer-5: var(--ink-2);    --layer-6: var(--accent);

  /* texture */
  --grain: url("data:image/svg+xml,…feTurbulence baseFrequency .85, 3 octaves, alpha .16…"); /* copy from concept-3 */
  --pattern: radial-gradient(circle at 1.5px 1.5px, rgba(31,107,71,.13) 1.1px, transparent 1.6px) 0 0/7px 7px; /* halftone dot field */
  --blend: multiply;
  --shadow-card: 6px 6px 0 var(--accent-2);   /* hard offset, like a misprint */
  --shadow-pop:  3px 3px 0 var(--ink);

  /* type */
  --font-display: var(--ff-fraunces), Georgia, serif;
  --font-body:    var(--ff-newsreader), Georgia, serif;
  --font-mono:    var(--ff-dm-mono), ui-monospace, monospace;
  --display-settings: "opsz" 144, "SOFT" 30, "WONK" 1;
  --display-weight: 560;
  --display-case: none;
  --display-track: -0.025em;
  --fs-00: .75rem; --fs-0: .875rem; --fs-1: 1.0625rem; --fs-2: 1.375rem;
  --fs-3: 1.875rem; --fs-4: 2.5rem; --fs-5: 3.5rem;
  --fs-hero: clamp(3.2rem, 11vw, 8.6rem);     /* perfect fourth, ~1.333 */
  --lh-body: 1.55; --lh-display: .92;

  /* radius: square-cut printed slugs */
  --r-0: 0; --r-1: 2px; --r-2: 3px; --r-pill: 2px;

  /* spacing: 8pt, book-like margins */
  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 24px;
  --s-6: 32px; --s-7: 48px; --s-8: 72px; --s-9: 112px;
  --measure: 62ch;

  /* motion */
  --dur-fast: 140ms; --dur-med: 320ms; --dur-slow: 1100ms;
  --ease-out: cubic-bezier(.2,.7,.2,1);
  --ease-press: cubic-bezier(.7,0,.3,1);
  --accent-motion: misregister 7s ease-in-out infinite;  /* vermilion overprint drifts out of register */
  --swap-label: "Pulling a new proof";
}
```

### 2.2 Strata (reads dark): soil core under a field lamp

```css
[data-theme="strata"] {
  color-scheme: dark;

  --bg:          #16110D;  /* loam */
  --bg-2:        #1F1813;
  --surface:     #241C16;
  --ink:         #EEE5D2;  /* chalk          15.0:1 bg | 13.4:1 surface */
  --ink-2:       #BDB09A;  /* secondary       8.8:1 bg |  7.9:1 surface */
  --ink-3:       #9C8F7B;  /* meta, folios    5.9:1 bg |  5.3:1 surface */
  --accent:      #E0AE4C;  /* ochre           9.2:1 bg |  8.2:1 surface */
  --accent-2:    #A9C98A;  /* lichen         10.2:1 bg |  9.1:1 surface */
  --accent-ink:  #E0AE4C;
  --on-accent:   #16110D;  /* on ochre 9.2:1 */
  --rule:        #8A7560;  /* control borders 4.3:1 bg | 3.8:1 surface (was #6B5A48, failed) */
  --rule-soft:   rgba(238,229,210,.14);
  --focus:       #A9C98A;
  --ok:          #A9C98A;
  --warn:        #E0AE4C;
  --danger:      #E07A55;  /* rust 6.3:1 bg | 5.7:1 surface */
  --data-1:      #E0AE4C; --data-2: #A9C98A; --data-3: #E07A55; --data-4: #C9B79A;
  --halftone:    rgba(224,174,76,.9);
  --overprint:   rgba(169,201,138,.9);
  --layer-1: #E0AE4C; --layer-2: #A9C98A; --layer-3: #E07A55;
  --layer-4: #C9B79A; --layer-5: #BDB09A; --layer-6: #E0AE4C;

  --grain: url("data:image/svg+xml,…feTurbulence baseFrequency .7, 2 octaves, alpha .07…");
  --pattern:
    repeating-radial-gradient(circle at 18% 30%, transparent 0 38px, rgba(224,174,76,.07) 38px 39px),
    repeating-radial-gradient(circle at 86% 78%, transparent 0 46px, rgba(169,201,138,.06) 46px 47px); /* contour rings */
  --blend: screen;
  --shadow-card: 0 18px 40px rgba(0,0,0,.45);
  --shadow-pop:  0 6px 18px rgba(0,0,0,.4);

  --font-display: var(--ff-bricolage), "Arial Narrow", sans-serif;
  --font-body:    var(--ff-hanken), system-ui, sans-serif;
  --font-mono:    var(--ff-martian), ui-monospace, monospace;
  --display-settings: "opsz" 96, "wdth" 75;
  --display-weight: 780;
  --display-case: uppercase;
  --display-track: -0.01em;
  --fs-00: .75rem;   /* raised from .6875: Martian Mono at 11px is too small for body meta */
  --fs-0: .8125rem; --fs-1: 1rem; --fs-2: 1.25rem;
  --fs-3: 1.5625rem; --fs-4: 2rem; --fs-5: 2.75rem;
  --fs-hero: clamp(3.4rem, 13vw, 9.4rem);    /* major third, condensed caps */
  --lh-body: 1.6; --lh-display: .88;

  /* radius: water-worn pebbles */
  --r-0: 6px; --r-1: 12px; --r-2: 22px; --r-pill: 999px;

  /* spacing: tighter, like a borehole log */
  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 22px;
  --s-6: 28px; --s-7: 44px; --s-8: 64px; --s-9: 96px;
  --measure: 60ch;

  --dur-fast: 160ms; --dur-med: 420ms; --dur-slow: 1100ms;
  --ease-out: cubic-bezier(.16,.8,.24,1);
  --ease-press: cubic-bezier(.7,0,.3,1);
  --accent-motion: contour-drift 40s linear infinite;   /* contour rings creep like groundwater */
  --swap-label: "Taking a core sample";
}
```

### 2.3 Shared tokens (both worlds)

```css
:root {
  --gutter: 16px;            /* 360-767 */
  --gutter-md: 32px;         /* 768+ */
  --gutter-lg: 68px;         /* 1280+ */
  --maxw: 1144px;
  --tap: 44px;               /* minimum hit target [graft C2] */
  --z-header: 40; --z-sheet: 50; --z-press: 60; --z-toast: 70;
}
```

### 2.4 Admin shape (`content/theme.json`)

```json
{
  "default": "auto",
  "themes": {
    "almanac": { "label": "Almanac", "reads": "light", "swapLabel": "Pulling a new proof", "tokens": { "--bg": "#F2EADB" } },
    "strata":  { "label": "Strata",  "reads": "dark",  "swapLabel": "Taking a core sample", "tokens": { "--bg": "#16110D" } }
  }
}
```
Theme **keys** (`almanac`, `strata`) are stable identifiers. Admin edits `label`, `swapLabel` and `tokens`. The UI always shows `label`.

---

## 3. Signature interaction: "Pull a new proof"

**The control.** A button labelled with the *other* world's name: "Reprint in Strata" or "Reprint in Almanac". It has a two-ink swatch glyph: two overlapping circles in the current and next world's accent colours. It is never a sun or moon icon.
- Accessibility: `aria-label="Switch to {label} theme"`, and `aria-pressed` is not used (this is an action, not a toggle).
- Placement: in the header on desktop (≥1024px). On mobile it is inside the Contents sheet, plus a 44px swatch button in the top bar.
- Almanac look: a square button with `--shadow-pop`. Strata look: a pill.

**The sequence** (about 1.3s in total; the page stays interactive afterwards, and focus stays on the button):
1. **0ms:** the control presses: `translate(2px,2px)` and its shadow collapses. The tag appears in the next world's ink: a registration-mark glyph plus `{swapLabel} · {label}`.
2. **0-520ms, ink-on:** seven horizontal bands (`grid-template-rows: repeat(7,1fr)`) roll in from left to right in the **next** world's `--bg`, staggered 45ms per band. Each band has a 14px leading edge in the next world's `--accent`, like the lip of a brayer.
3. **~600ms:** `data-theme` flips under full cover.
4. **640-1160ms, lift-off:** the bands roll away to the right, with the same stagger, revealing the new world.
5. The "settle" accent of the new world plays once: in Strata the core layers drop into place; in Almanac the overprint snaps back into register, then begins to drift.

**Implementation:**
- **Progressive enhancement [graft C1].** Where `document.startViewTransition` exists, flip the theme inside the transition. Animate `::view-transition-new(root)` with a 7-band `clip-path: polygon(...)` that grows per band, so the **actual** new page is revealed band by band behind the brayer lip. The lip is a separate fixed overlay drawn on top, with `view-transition-name: press-lip`, so the page snapshot does not hide it (this fixes C1's known gap).
- Without View Transitions, use the overlay path from concept 3: `.press` bands with `transform: scaleX`, and the theme swapped while they cover the page.
- Use only `transform`, `clip-path` and `opacity`. Never animate layout properties.
- **Reduced motion:** swap instantly, then a 150ms cross-fade of `main` and `header`. No bands and no tag. Animated backgrounds stop, and the har-live trace renders as a still frame **[graft C1]**.
- **Default and persistence:**
  - An inline no-flash script in `<head>`, before paint, reads the settings in this order: `?theme=almanac|strata` (for screenshots and QA), then `localStorage["ghp-theme"]` (wrapped in try/catch), then `prefers-color-scheme` (dark → strata, otherwise almanac).
  - It sets `data-theme` on `<html>` and the `color-scheme` meta.
  - If the stored value is a key that no longer exists, ignore it.
- Announce the change through a polite live region: "Strata theme on."

---

## 4. Typography (Google Fonts via `next/font/google`)

Load all six families with `display: 'swap'`, and expose each as a CSS variable (`--ff-*`). Subset: latin.

| Role | Almanac | Strata |
|---|---|---|
| Display | **Fraunces** (variable: `opsz` 9-144, `wght` 300-900, `SOFT`, `WONK`; italic on) | **Bricolage Grotesque** (variable: `opsz` 12-96, `wdth` 75-100, `wght` 300-800), uppercase, `wdth` 75 |
| Body | **Newsreader** (variable: `opsz`, `wght` 400-700, italic) | **Hanken Grotesk** (400/500/600/700) |
| Mono / meta | **DM Mono** (400/500) | **Martian Mono** (variable: `wdth` 87.5, `wght` 400/600) |

Rules:
- Display is used for h1 and h2, the big numbers (27s → 3.5s, 85.27%) and card titles. Never for body copy or labels.
- Mono is for kicker lines, folio numbers, dates, demo slugs, chip slugs, table headers and code. Set mono labels uppercase with tracking `.08-.14em`, at `--fs-00` or larger.
- Body text is at least 16px (`--fs-1`). Line length is capped at `--measure`.
- Hero name: `--fs-hero`, `--lh-display`. In Almanac a vermilion overprint copy of the name sits behind at 0.85 opacity and runs `--accent-motion`. In Strata the overprint is a lichen band showing through the bottom 38% of the letters (`clip-path: inset(62% 0 0 0)`).
- One drop cap per page, on the hero lede: 3 lines, `--accent-2` (decorative and large, so the contrast exemption applies).
- Numbers: use `font-variant-numeric: tabular-nums` in tables, meters and the grid reading.
- Italic is Almanac-only emphasis (`<em>` renders italic and green). In Strata, `<em>` renders `--accent`, upright.

---

## 5. Layout grid

- **Mobile first.** 360-767px: 4 columns, 16px gutters and side margins. 768-1279px: 8 columns, 24px gutters, 32px margins. 1280px and up: 12 columns, 24px gutters, max width 1144px centred.
- **Page furniture (almanac masthead):**
  - A top strip in mono `--fs-00`: location left, "Every claim has a working proof" centre (hidden below 768px), and "Edition: {label}" right.
  - Below it the header row, with a 1px `--rule` bottom border.
  - Sections are numbered folios (`02 Working record`, `03 Skill → proof`, …). The folio number is set in display type in `--accent-ink`.
- **Section rhythm:** `padding-block: var(--s-8)` on mobile and `var(--s-9)` on desktop. Section heads use a 2px `--rule` top border in Almanac. In Strata a 4px `--layer-n` top edge sits on the first card.
- **Hero:** 7/5 split at ≥1024px (text left, plate right). It stacks below that, with the plate after the CTAs. The plate is **never** scaled below 320px wide; below that, the layer labels switch to the stacked list form (6.1).
- **Working record:** 3 columns at ≥900px, joined by hairlines in Almanac and gapped cards in Strata. One column on mobile.
- No horizontal scroll at any width. Chip rows **wrap** and never overflow (this fixes C2's mobile overflow). Wide tables scroll inside their own container with a visible edge fade.
- Order and visibility of every section come from `content/sections.json`. The layout must not assume a fixed order.

---

## 6. Components (styling rules)

### 6.1 Core-sample plate (hero only; see section 9)
- A `figure` with a mono plate head: "Plate 1 · Core sample of a career" on the left, "newest on top" on the right.
- The SVG core: each layer is a wavy band (`path` with a seeded sine-noise top edge) filled with its halftone pattern (`#ht-1`…`#ht-4`, SVG `<pattern>`, `fill: var(--halftone)`). The label row reads: year (mono, `--accent-ink`), label (mono, `--ink`), and demo slug (mono, `--ink-3`, right-aligned). Each label sits on a `--surface` plate so text never sits on halftone.
- Every layer is a real `<a>` to `/playground/{slug}` with a 44px minimum row height and an accessible name like "2025, Piron Labs, 27s to 3.5s. Proof: web-perf-lab".
- Hover and focus: that layer lifts 2px, its top edge line thickens to 2px `--accent`, and a thin drill line draws down to it from the top of the core (`stroke-dashoffset`, `--dur-med`).
- Below 480px: the core draws as simplified bands (no labels in the SVG, `aria-hidden`). An ordered list of the same layers follows beneath, as tappable rows.
- **Data** comes from `content/` (experience, projects, education, publications); nothing is hard-coded. Seed layers, from the verified context, newest on top:
  - Euthyna, Sep 2025 to present (ESG + AI pipelines) → esg-gap-checker
  - Piron Labs 2025, 27s → 3.5s → web-perf-lab
  - MotionIQ Dec 2024 (sensors → RabbitMQ) → rabbitmq-sim
  - Webox 2024 (VoodVR, Stripe Connect) → stripe-connect-flow
  - First repos 2022 (C, C++) → code-judge
  - PUCIT 2021 (BS Information Technology) → algo-visualizer
  - Optional thin marker bed at the top: HumCareADL, MTAP 2026 → har-live
  - A layer whose source item is `enabled: false` is not drawn.
- **Live reading:** beneath the core, UK grid carbon intensity (gCO₂/kWh) from carbonintensity.org.uk, fetched server-side with ISR (30 min).
  - The index word (LOW, MODERATE, HIGH…) appears as text in a bordered slug, so colour is never the only signal.
  - On failure, show "—" and "Feed unavailable. Nothing is estimated." Never show a cached value as live without its timestamp. Always show "as of HH:MM UTC".

### 6.2 Buttons
- **Primary:** Almanac is `--ink` fill, `--on-accent` text, square corners. Strata is `--ink` (chalk) fill, `--bg` text, pill-shaped.
- **Secondary:** a 1px `--rule` border, transparent fill.
- Both are set in mono uppercase, `--fs-0`, tracking .08em, with a trailing arrow glyph and a minimum height of 44px.
- **Press state:** Almanac `translate(2px,2px)` and the shadow shrinks. Strata `scale(.98)`.
- **Focus:** a 2px `--focus` outline with a 2px offset, on every interactive element. Never remove it.

### 6.3 Skill → proof chips (wood-type slugs)
- Each chip has two parts joined by a hairline: the **skill** (body font, weight 600, `--ink`) on the left, and `→ demo-slug` (mono, `--accent-ink`) on the right, on a `--bg-2` block.
- Almanac: square, 1px `--rule` border. Strata: radius `--r-1`, and `inset 0 -3px 0 var(--layer-n)` for a coloured bottom edge.
- **Hover and focus [graft C2]:** a 4px ink dot travels along the joining hairline from skill to slug (`offset-path` or `translateX`, 420ms, once per hover). The slug side darkens one step.
- Every skill in `content/skills` must map to ≥1 slug. A skill with more than one proof shows `→ slug +2` and expands on tap.
- Rows wrap with a gap of `--s-2 --s-3`.

### 6.4 Working-record entries (ledger)
- **Meta line [graft C2]:** mono `--fs-00` in `--ink-3`: `SEP 2025 – PRESENT · REMOTE · LAYER 1`.
- Then the title (display, `--fs-3`), the organisation (italic body in Almanac; `--ink-2` upright in Strata), and 2-4 bullets.
- It ends in a "Proof:" row with **one or more** slug links, underlined 1px in `--accent-ink`.
- **The one metric** is Piron Labs' 27s → 3.5s: "27s" in display type with a vermilion strike-through (`text-decoration-thickness: .08em`), then an arrow, then "3.5s" in `--accent`. Do not invent any other metrics. Fields marked TODO stay hidden.

### 6.5 Research block
- A `--bg-2` inset panel holding the paper title (display), journal, volume and year, and a DOI link in mono.
- **Authorship:** show "2nd of 5 authors". Do **not** list co-author names; the brief excludes colleague names.
- **Accuracy meters [graft C1]:** HumCareADL 85.27%, CogAge 81.83% and WISDM 98.52%, labelled "average accuracy as reported in the paper". Each is a printed bar: a 6px `--rule-soft` track and a fill in `--data-1/2/3`, with the value in display type and `tabular-nums`. The fill animates from 0 once when it enters view (`--dur-slow`); under reduced motion it is static.
- MotionIQ is shown as the neighbouring pipeline, not as the paper's pipeline, because the link is unverified. The 8 steps appear as a numbered grid, each step with a waveform glyph.
- The "Best Graphic Designer · PUCIT" stamp: a circular text stamp rotated -8°, in `--accent-2` in Almanac or dashed lichen in Strata. It has an `aria-label` and is decorative in role.

### 6.6 Navigation
- **Desktop (≥1024px):** inline mono links in the header, with the current section marked by a 2px underline in `--accent` (scroll-spy). The "Reprint in …" control sits on the right. A `Ctrl/Cmd+K` command palette styled as an index page (dot leaders, folio numbers).
- **Mobile, bottom folio bar [graft C1]:** a fixed bottom bar, 64px plus safe-area inset, `--surface` background with a top rule. It holds 4 items: Record, Proofs, Playground, and Contents. Each has an icon above a mono label, and the current item gets a 3px top edge in `--accent`.
- **Contents sheet:** a bottom sheet that opens from the Contents item, 88vh at most, with a focus trap and Esc/scrim/close to dismiss.
  - Almanac: a contents page with dot leaders and folio numbers.
  - Strata: a borehole log, each row with a 6px left bar in `--layer-n`.
  - Rows are 52px tall. The theme control and the socials sit at the bottom.
- **Mobile top bar:** a register-mark logo, the name, and the 44px theme swatch button.
- Skip link first in the DOM, visible on focus.

### 6.7 Cards, inputs and tables (shared primitives)
- **Card:** `--surface` fill with `--r-2`.
  - Almanac: a 1px `--rule` border and `--shadow-card` (hard vermilion offset 6px) on feature cards; plain cards have the border only.
  - Strata: no border, `--shadow-card`, and a 4px `--layer-n` top edge.
- **Inputs:** 44px high, a 1px `--rule` border, `--surface` fill, mono placeholder in `--ink-3`, and the `--focus` outline.
  - The label is always visible, above the field, in mono `--fs-00`.
  - Errors show in `--danger` with an icon and text, linked with `aria-describedby`.
- **Tables:** mono headers in `--fs-00`, hairline row rules and `tabular-nums`.
- **Status badges:** a text slug with a border colour taken from `--ok`, `--warn` or `--danger`. The text is always present.
- **Toasts:** bottom-left on desktop, above the folio bar on mobile. The printed "slip" style has a torn top edge in Almanac (SVG mask) and a pill in Strata.

---

## 7. Iconography

- **An inline SVG sprite, drawn in-house.** No emoji, and no mixing of icon libraries. If a library is needed as a base, use Lucide at `stroke-width: 1.5` and restyle it to match.
- Grid 24×24, 1.5px stroke, `stroke-linecap: square` in Almanac and `round` in Strata (switched with `--icon-cap`). Colour is `currentColor`.
- **Family:** a register mark (logo, loading, the transition tag), the two-ink swatch (theme control), an arrow, dot leaders, and a strata glyph (3 wavy lines, for the record).
- **Waveform glyphs [graft C1]** mark the signal and sensor demos: pulse (har-live), sine (sensor-pipeline), square (rabbitmq-sim / queues), saw (bullmq-jobs), flat line (empty state).
- Plus a leaf/contour glyph for ESG demos, a broadsheet glyph for design demos, and a node-graph glyph for agent demos.
- Each playground category has **one** glyph, used on its cards, filter chips and the folio bar. Decorative icons get `aria-hidden="true"`. Icon-only buttons need an `aria-label`.

---

## 8. Motion rules

- CSS, SVG and canvas only. No animation libraries on the homepage.
- Animate only `transform`, `opacity`, `clip-path`, `stroke-dashoffset` and `background-position`.
- **Durations:** micro `--dur-fast`; state change `--dur-med`; entrance `--dur-slow` at most. Nothing loops faster than 7s except live data.
- **Accent motion (one per world, always ambient, always subtle):**
  - Almanac `misregister`: the overprint drifts 2px over 7s.
  - Strata `contour-drift`: the contour field translates 40×60px over 40s.
  - These are the **only** infinite animations on the homepage.
- **Entrances:**
  - Strata: layers `settle` (translateY -14px → 0, 90ms stagger).
  - Almanac: layers "print" (clip-path wipes from left, 60ms stagger).
  - Both play once per session, on first view of the hero (`IntersectionObserver`), with no scroll-jacking.
- **`prefers-reduced-motion: reduce`:**
  - Ambient motion off.
  - Entrances replaced by immediate display.
  - Theme switch becomes a 150ms cross-fade.
  - Canvas traces show one still frame with a "Play" button.
  - Meters show their final value.
- Pause all canvas and ambient animation when the tab is hidden (`visibilitychange`) or the element is off-screen.
- No motion on hover larger than 3px of travel. No parallax.

---

## 9. The single signature hero moment

**The core sample, drilled live.** On first view:
1. The plate head prints.
2. The layers arrive bottom-up, oldest first (PUCIT, then first repos, and so on up to Euthyna). In Almanac they print in; in Strata they settle.
3. When the top layer lands, a thin drill line runs down the full core once (600ms).
4. The grid reading beneath resolves from "…" to the live number with its index slug.

From then on the plate is a live index: every layer is a link to the demo that proves it, and hovering or focusing one drills to it.

Nothing else on the homepage competes with this: no second hero animation, no autoplaying canvas above the fold. The har-live trace lives in its playground card below the fold.

---

## 10. Playground card style ("specimen sheet")

Every demo card on `/playground`, and the featured card on the homepage, follows this one pattern:

```
┌───────────────────────────────┬──────────────────────────────┐
│ PREVIEW WINDOW (16:10)        │ CATEGORY GLYPH · RUNS IN BROWSER │ ← mono kicker, --ink-3
│  live or still preview drawn  │ Title (display --fs-3)         │
│  in the current world's inks  │ One-line what-it-does (body)   │
│  "5 s window" / "seed 0417"   │ ┃ MIRRORS  real work it mirrors │ ← inset, left bar --accent-2
│  mono caption bottom-left     │ [skill] [skill] [skill]        │ ← proves chips
│                               │ [Open demo →] [secondary]      │
│                               │ phone note: "Works on phone" / "Desktop best: …" │
└───────────────────────────────┴──────────────────────────────┘
```
- It stacks on mobile, with the preview on top at full width.
- **Almanac:** a 1px `--rule` border and a hard 6px `--accent-2` offset shadow on the featured card. The preview has a halftone ground and sprocket holes down the left edge on the har-live card only **[graft C1]**.
- **Strata:** radius `--r-2`, a 4px top edge in the category's layer colour, `--shadow-card`, and a preview on a `--bg` well with a faint graticule.
- **Previews:**
  - Lazy-mounted when the card nears the viewport; a static SVG poster until then.
  - They redraw in the current world's `--data-*` inks when the theme changes.
  - Canvases pause off-screen.
- **Featured on the homepage:** har-live (an IMU trace drawn like a seismograph: 3 axes, a marked 5-second window, activity labels from the dataset vocabulary, and a caption stating that it is a synthetic replay on desktop) **[graft C1]**. Admin can swap it for design-studio's poster press (a seeded poster and "Pull another print").
- **Phone note:** always present. Either "Works on phone" or an honest "Best on desktop: {reason}", with a fallback link.
- **Hidden demos:** excluded entirely. No disabled cards.

---

## 11. Colophon footer [graft C2]

The footer is an engineering-drawing title block set as a print colophon. It is a 4-cell grid (2 cells on mobile) with 1px rules:
- Project: "Malik Haider Ali, portfolio"
- Edition: the current theme label
- Contact: email, GitHub `haid-er` and LinkedIn `in/haid-er`
- Note: his motto, "Code with purpose, build with passion, learn without limits."

The last line reads "Set in {fonts of this world}. Printed at zero running cost." The Person JSON-LD with `sameAs` lives in the layout, not in the footer markup.

---

## 12. Do / Don't

**Do**
- End every role, project and skill in a "Proof:" link to a real demo slug from the registry.
- Keep both worlds structurally identical. Only tokens and theme-scoped decoration differ.
- Put text on solid `--surface` or `--bg` plates, never directly on halftone, contour or grain.
- Use `--accent-ink` for small red text in Almanac, and keep `--accent-2` for decoration and large display type.
- Show live data with a timestamp and an honest failure state ("Nothing is estimated").
- Test both worlds at 360, 768 and 1280px, with keyboard only, and with reduced motion on.
- Let admin rename worlds; read labels from `content/theme.json` everywhere, including the switch tag and the "Edition:" line.
- Keep homepage JS under 150KB gzip. The core plate is server-rendered SVG, with only the hover and drill enhancement as a client island.

**Don't**
- Don't use dark navy, purple or cyan gradients, glassmorphism, frosted blur, neon glows, or a centred SaaS hero with a gradient blob.
- Don't use Inter anywhere, emoji as icons, or a sun/moon toggle.
- Don't use the words "light mode" or "dark mode" in the UI. The worlds have names.
- Don't list co-author or colleague names. Don't mention VLAD, CCNL-FallNet or LOGICCOVE. Don't link private repos. Don't show star counts.
- Don't invent metrics, user counts or percentages. The only numbers allowed are the ones in `content/` (27s → 3.5s, the paper's accuracies, dates, CGPA if enabled).
- Don't present MotionIQ as the HumCareADL pipeline, or label it as his FYP. Both are unverified.
- Don't autoplay anything above the fold except the one hero moment. No scroll-jacking, parallax or cursor trails.
- Don't use `--rule-soft` as the only edge of a control. Don't use colour as the only signal of state.
- Don't hard-code hex values, font names or theme names in components.
