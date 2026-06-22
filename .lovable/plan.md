## Goal

Rewire `supabase/functions/business-lookup/index.ts` to use the legacy Google Places "Find Place From Text (phonenumber)" + "Place Details" endpoints with the existing project API key, and add a fallback to `VITE_GOOGLE_PLACES_API_KEY` if `GOOGLE_PLACES_API_KEY` is unset.

## Changes (single file)

`supabase/functions/business-lookup/index.ts`

1. **API key resolution**
   ```ts
   const placesKey =
     Deno.env.get("GOOGLE_PLACES_API_KEY") ??
     Deno.env.get("VITE_GOOGLE_PLACES_API_KEY");
   ```
   Keep the 500 response if neither is set.

2. **Replace the Places (New) `searchText` block** with two legacy calls:

   - **Find Place from Phone Number**
     ```
     GET https://maps.googleapis.com/maps/api/place/findplacefromtext/json
       ?input={E164 phone, URL-encoded}
       &inputtype=phonenumber
       &fields=place_id
       &key={placesKey}
     ```
     Read `candidates[0].place_id`. If missing or `status !== "OK"`, return `{ found: false, business: null, phone: phoneE164 }`.

   - **Place Details**
     ```
     GET https://maps.googleapis.com/maps/api/place/details/json
       ?place_id={place_id}
       &fields=place_id,name,formatted_address,formatted_phone_number,international_phone_number,opening_hours,types,website,rating
       &key={placesKey}
     ```
     If `status !== "OK"`, log and return `{ found: false, ... }`.

3. **Map the legacy response** to the existing `business` shape returned to the frontend, plus `category` and `rating` (additive, no removals):
   ```ts
   const business = {
     business_name: details.name ?? "",
     address: details.formatted_address ?? "",
     phone: details.formatted_phone_number ?? details.international_phone_number ?? phoneE164,
     website: details.website ?? "",
     business_hours: (details.opening_hours?.weekday_text ?? []).join("\n"),
     types: details.types ?? [],
     category: details.types?.[0] ?? "",
     rating: typeof details.rating === "number" ? details.rating : null,
     place_id: details.place_id ?? "",
   };
   ```
   Drop the now-unused `formatHours` helper (legacy uses `weekday_text` directly).

4. **Keep everything else identical**: Zod body validation, `toE164`, `suggestWithAI` post-processing, response envelope `{ found, business, suggestion, phone }`, CORS, error handling.

5. **Not-found contract** matches what the frontend already expects: `{ found: false }` (with `business: null, phone: phoneE164` retained for backward compatibility).

## Out of scope

- No frontend changes — `Step1FindBusiness` already handles both branches.
- No new secrets, no `add_secret` call — using the existing `GOOGLE_PLACES_API_KEY` already in the project.
- No changes to other edge functions.
