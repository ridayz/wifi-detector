# DESIGN — wifi-detector

The approved visual language for this project (approved by the user on
2026-11-13: "udh mantep ini"). **Do not revert to the Dev.Team design-language
default palette (ink ramp + amber accent) — this palette is a deliberate,
user-approved deviation.** The token architecture and rules from
`.opencode/skills/design-language/SKILL.md` still apply; only the ramp is ours.

## Theme names

| Theme | Mode | Name |
| --- | --- | --- |
| Dark | default | **Midnight Neon** |
| Light | toggle | **Tokyo Day** |

Structural rules (both themes):

- Single neutral ramp + one accent; hairline borders (text color at 8–17% opacity)
- Numbers in mono (`--font-mono`) + `tabular-nums`
- Spacing scale 4/8/12/16/22/32; radii 8/12/16/20
- One easing (`--ease`), durations ≤ 260 ms for feedback; no width/height transitions
- No gradients, no emoji-as-icons, no glow in the light theme
- Neon glow lives in the dark theme only (see "Neon rules" below)

## Tokens — dark (`Midnight Neon`)

```css
--bg:        #0e1522;   /* panel field */
--surface:   #131d2e;   /* panel background */
--surface-2: #18253d;   /* stat tiles, table hover */
--surface-3: #1f3050;   /* chips, inputs */
--line:        rgba(201,214,245,.08);
--line-strong: rgba(201,214,245,.17);
--text:   #c9d6f5;
--text-2: #a9b8dd;
--text-3: #7f8eb6;
--accent: #29b6ff;      /* electric blue — bars, links, primary button, focus */
--accent-soft: rgba(41,182,255,.18);
--glow-soft:   rgba(41,182,255,.45);
--glow-accent: rgba(41,182,255,.65);
--glow-ok:   rgba(158,206,106,.5);
--glow-warn: rgba(224,175,104,.5);
--glow-bad:  rgba(247,118,142,.5);
--ok:   #9ece6a;   (congestion low / ok)
--warn: #e0af68;   (distance / medium)
--bad:  #f7768e;   (band-mismatch / high)
```

## Tokens — light (`Tokyo Day`)

```css
--bg:        #eceef4;
--surface:   #f6f7fa;
--surface-2: #e7e8ee;
--surface-3: #dbdbe3;
--line:        rgba(52,59,89,.10);
--line-strong: rgba(52,59,89,.20);
--text:   #343b59;
--text-2: #535b78;
--text-3: #8c93ac;
--accent: #2e7de9;
--accent-soft: rgba(46,125,233,.13);
--ok:  #376a36;  --warn: #8c6c3e;  --bad: #b8455e;
/* no glow — neon stays out of the light theme */
```

## Neon rules (dark only)

Neon is a spice, not a paint. Glow is used on:

- Logo (`.logo` — 0 0 16px)
- Status dots (`.dot-ok/.dot-bad/.dot-wait` — 0 0 8px)
- Signal bars that are on (`.bars i.on` — 0 0 7px)
- `.connected-tag` ("you" pill)
- `.chip-high` congestion chip (subtle red glow)
- `.btn-primary` (Connect) + hover intensify; header buttons get a blue border+glow hover
- `.panel` + `.topbar` get a faint neon hairline (`rgba(41,182,255,.22/.28)`)

Everything else stays flat. If in doubt, no glow.

## Components inventory

Header: brand (logo wifi glyph in `--accent`), title, tagline, status
(`.dot.dot-ok/.dot-wait/.dot-bad` + text), Fullscreen, Scan, Theme toggle.
Panels: connected (SSID big, BSSID mono dim, 2×2 stat grid, RSSI sparkline
canvas in accent color), diagnosis (`.cause.cause-*`, confidence tag), congestion
(chips per band/channel), networks table (bars + mono numbers, inset accent
bar for the connected row). Modal: connect flow — `.btn-primary` in `--accent` blue, hairline ghost cancel. Icon: rounded
`#0e1522` square + `#29b6ff` wifi arcs (`scripts/native-launcher/MakeIcon.cs`).

## Changing the palette

1. Edit only the token blocks in `src/public/styles.css` (`:root[data-theme=…]`).
2. Never set raw colors inside components — always through the tokens.
3. Both themes must stay readable (≥4.5:1 for text).
4. Rebuild the `.ico` if the brand colors change (`MakeIcon.cs`, then
   `native-launcher/build.cmd`).

## Checklist before marking done

- [ ] Both themes render; toggle persists; no FOUC
- [ ] Numbers mono + tabular; no magic spacing off the 4px scale
- [ ] No gradient/glow in light; no emoji-as-icons; console error-free
- [ ] Screenshot at one narrow and one wide width; nothing overflows
