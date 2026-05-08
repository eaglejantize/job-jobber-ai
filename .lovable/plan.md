## Goal
Reposition homepage copy in `src/pages/Index.tsx` from home-services language to med-spa / appointment-based language. No structural or logic changes.

## Exact replacements

1. **Hero tagline (line 48)**
   - From: `Turn missed calls into booked jobs`
   - To: `Turn missed calls into booked consultations`

2. **Hero headline (line 51)**
   - From: `Stop Missing Service Calls — Even After Hours`
   - To: `Stop Missing Consultation Calls — Even After Hours`

3. **Hero subhead (line 54)**
   - From: `Answer every call. Capture details. Get booked jobs.`
   - To: `Answer every call. Capture details. Book consultations.`

4. **Hero value-prop (line 57)**
   - From: `Every missed call is a lost $150–$500 job.`
   - To: `Every missed call is a lost $400–$2,000 consultation.`

5. **Hero monthly-loss line (line 60)**
   - From: `Miss just 2 calls a day = $6,000–$15,000/month lost.`
   - To: `Miss just 2 calls a day = $24,000–$120,000/month in lost consultations.`

6. **Hero fine-print (line 77)**
   - From: `Built for appliance repair, HVAC, plumbing, electrical, and local service businesses.`
   - To: `Built for med spas, aesthetic clinics, wellness practices, and appointment-based businesses.`

7. **Stats card (line 206)**
   - Stat: `$150–$500` → `$400–$2,000`
   - Label: `average value of a single service call` → `average value of a single med spa consultation`

8. **HearInAction description (line 362)**
   - From: `Listen to a real-style service call handled by the AI receptionist.`
   - To: `Listen to a real-style consultation call handled by the AI receptionist.`

9. **Remaining home-service language sweep**
   - `industries` array (lines 20-29): replace industry names with med-spa equivalents (Med Spas, Aesthetic Clinics, Wellness Practices, Skin Care, Laser Clinics, IV Therapy, Cosmetic Surgery, Day Spas).
   - Features array (line 33): replace `job` in `Lead capture (name, phone, address, job)` → `treatment`.
   - Section heading (line 242): `Built for service businesses` → `Built for med spas`.
   - Done-for-you section (line 283): `start getting jobs` → `start booking consultations`.
   - Pricing section (line 298): `1–2 captured jobs` → `1–2 captured consultations`.
   - Pricing box (line 316-317): `first 1–2 calls` → `first 1–2 consultations`; `one job per day` → `one consultation per day`.
   - Hero trust bar (line 88): `Pays for itself with 1–2 jobs` → `Pays for itself with 1–2 consultations`.
   - Transcript in `HearInAction` (lines 388-395): rewrite appliance-repair demo dialogue into a med-spa consultation dialogue.

## Scope
Only `src/pages/Index.tsx` is modified. No other files touched.