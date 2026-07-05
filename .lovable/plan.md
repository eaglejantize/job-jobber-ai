## Root cause

The landing page wraps in `.light` to pin the light palette, but the `.light` block in `src/index.css` only re-declares color tokens. It does **not** re-declare `--gradient-hero` (or the other gradient/shadow tokens). When the app's theme toggle sets `<html class="dark">`, the `.dark` override of `--gradient-hero` (near-black) cascades into the landing subtree — so `Hero.tsx`'s `bg-gradient-hero` renders a dark navy background while `text-navy` stays dark navy. That is the low-contrast heading in the user's photos.

## Fix

One systemic change in `src/index.css`: add every token the `.dark` block overrides to the `.light` block so `.light` fully insulates its subtree from any `.dark` ancestor.

Tokens to add to `.light`:

- `--gradient-hero` (the light radial + linear gradient, same value as `:root`)
- `--gradient-navy` (unchanged from `:root`, but declared so it can't be overridden later)
- `--gradient-brand` (same)
- `--shadow-soft`, `--shadow-elevated`, `--shadow-glow` (same values as `:root`)
- Sidebar tokens (`--sidebar-*`) — same light values as `:root`
- Explicitly unset `--ink` so the `.dark`-only `--ink` alias can't leak in

No component edits, no palette changes. Values copied verbatim from the `:root` block so light-mode appearance is unchanged; the only behavioral change is that dark-mode users viewing the landing now see the intended light hero gradient behind the dark navy heading.

## Verification

Run Playwright against `/` at 1280×1800 in two states:
1. Default (no `.dark` on `<html>`) — hero renders light gradient, dark heading. Screenshot.
2. `document.documentElement.classList.add('dark')` before navigation — hero must still render the light gradient with the dark heading (this is the regression being fixed). Screenshot and compare.

Also spot-check `LiveDemo` and `FinalCTA` still render their intentional navy gradients with white text in both states.

## Out of scope

No new colors, no per-component `text-*`/`bg-*` overrides, no changes outside `src/index.css`.
