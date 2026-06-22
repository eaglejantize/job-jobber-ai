## Plan

Update `supabase/functions/business-lookup/index.ts`:

- Replace the current key lookup line with:
  ```ts
  const placesKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  ```
- Remove the `?? Deno.env.get("VITE_GOOGLE_PLACES_API_KEY")` fallback entirely.
- Keep the existing 500 error response when `placesKey` is missing.
- No other logic, validation, or response shape changes.

Then redeploy the `business-lookup` edge function via `supabase--deploy_edge_functions`.

No frontend changes, no new secrets, no other files touched.