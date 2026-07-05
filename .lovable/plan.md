Plan to restore readable contrast system-wide for the selected nav/button issue:

1. Fix the root cause in navigation/buttons
   - Replace the selected “Start Free Trial” nav button’s hardcoded `bg-navy + text-white` pairing with a semantic button pairing that changes together by theme (`bg-primary text-primary-foreground`, or the default Button variant).
   - Apply the same correction to the matching Dashboard and mobile nav CTA buttons in `SiteNav` so they cannot become light-on-light in dark mode.

2. Remove fragile foreground/background combinations
   - Search for other `bg-navy` / `text-white` and similar manually paired combinations in shared public UI.
   - Convert them to paired semantic tokens (`primary/primary-foreground`, `card/card-foreground`, `secondary/secondary-foreground`, etc.) instead of unrelated one-off colors.

3. Preserve the intended palette
   - Keep the existing Vektuor navy/blue brand feel.
   - Avoid changing MCP/settings functionality or backend code.
   - Avoid broad redesign; this is a visual QA contrast repair.

4. Verify visually
   - Review `/auth` in light and dark themes, focusing on the selected nav button and all header text.
   - Also spot-check the public pages that use the same shared nav/layout to confirm no button label, link, heading, or paragraph is blending into its background.
   - Confirm the selected “Start Free Trial” label is clearly readable against its button background before marking complete.