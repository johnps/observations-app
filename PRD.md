# Livelihood Monitor — Product Requirements Document

## Context

This app supports a government-linked rural livelihood programme in India. The administrative hierarchy is: state → district → block → field worker → household.

A **field worker** manages 40 households across 5–6 villages. Their responsibilities include:
- Forming small women's self-help groups
- Weekly training sessions (life skills, literacy skills, livelihood skills) for 3 years
- Setting up kitchen gardens
- Livelihood planning (minimum 2 livelihoods per household)
- Helping households purchase inputs and assets using government funds
- Setting up and training households on livelihoods (crops, livestock, nano-businesses)
- Helping households access government schemes (documents, applications, benefit tracking)

Livelihoods include: vegetables, goats, pigs, kirana shops, vegetable vending, mini roadside restaurants, trading, and other nano-businesses.

A **block lead** manages 25 field workers and supervises their execution on the ground.

A **district lead** supervises all block leads in their district.

A **state lead** has a read-only aggregated view across all districts in their state.

Field workers are paid a stipend; motivation varies. Physical village visits are not guaranteed.

---

## Roles

| Role | Platform | Auth |
|---|---|---|
| Block lead | Native Android app (offline-capable) | Google SSO |
| District lead | Web app (desktop browser) | Google SSO |
| State lead | Web app (desktop browser) | Google SSO |
| Admin | Web app (desktop browser) | Google SSO |

Roles are assigned manually by an admin in the webapp. Users log in via Google SSO and land in the experience matching their assigned role.

---

## User Journey 1: Block Lead — Logging a Field Observation

**Context:** Block lead is physically present in a village supervising a field worker. Connectivity may be poor or absent.

**Pre-condition:** App installed on Android. Block lead is logged in. App has synced the latest field worker → village mapping for this block lead.

**Steps:**
1. Block lead opens the app — already logged in via Google SSO, no re-auth needed.
2. Block lead taps "New Observation."
3. Block lead types or uses speech-to-text (Hindi, English, or mix) to record what they observed.
4. Block lead attaches one or more photos from their camera.
5. Block lead selects the field worker from a dropdown (showing only field workers assigned to this block lead).
6. Village dropdown refreshes to show only villages mapped to the selected field worker. Block lead selects the village.
7. App begins acquiring GPS on form open and shows a status line near the Submit button: "Acquiring GPS…" → "GPS acquired" once a fix is obtained, or "GPS unavailable — observation will be submitted without location" if acquisition fails. Submit is never blocked by GPS status.
8. Block lead taps "Submit."
9. If offline, the observation is saved locally and syncs automatically when connectivity returns.
10. If the observation repeatedly fails to sync (e.g. network errors over an extended period), it is moved to a "Failed Observations" list rather than silently discarded. The block lead is notified and can review the full content of the failed observation, then re-submit it manually.

**Post-condition:** Observation stored with: text, photos, GPS coordinates, timestamp, selected field worker, selected village, block lead identity. GPS coordinates accumulate against village names over time for future use.

**Failure post-condition:** If the observation cannot be synced after the maximum number of retries, its full content is preserved and visible in "Failed Observations" so the block lead can re-submit. The observation is never silently lost.

---

## User Journey 2: District Lead — Monitoring Field Visits & Activity Analysis

**Context:** District lead reviews coverage and activity across her region on a desktop browser.

**Pre-condition:** Block leads have synced observations. At least one auto-tag run has been completed.

**Steps:**
1. District lead logs in via Google SSO and lands on a dashboard for her region.
2. She sees a single frequency chart defaulting to "observations by block lead, this month." Block leads with zero observations are shown with their name and a zero count — not hidden.
3. She uses dropdowns to change the primary dimension (tag / village / block lead / period) and optionally a secondary dimension — e.g. "most frequent tags by block lead" or "visit frequency by village by period."
4. Chart updates instantly on each filter change.
5. Each observation has a GPS validity indicator: ✅ GPS coordinate was captured, 🚩 GPS coordinate is missing (likely a desk submission). Flagged observations are visually distinct in drill-down views.
6. She can drill into any flagged observation to see its GPS data (or lack thereof) alongside the village it was submitted against.

> **Post-MVP:** Flag will upgrade to proximity-based (✅ within adjustable radius of inferred village coordinates, 🚩 outside or unverifiable) once village coordinate inference is built. No schema change required.

**Post-condition:** District lead has a clear view of visit coverage, activity distribution by any dimension, and location integrity — including block leads with zero submissions.

---

## User Journey 3: District Lead — AI Tagging of Observations

**Context:** District lead tags accumulated observations from her district to enable activity analysis. She does not need to ask the admin — she can trigger tagging herself at any time.

**Pre-condition:** Untagged observations exist for her district's block leads. Tag definitions are loaded in the system.

**Steps:**
1. District lead navigates to her observations page and sees an "Auto-tag Now" button with a count of untagged observations in her district (e.g. "3 untagged observations").
2. She presses "Auto-tag Now." The app sends all untagged observations **scoped to her district's block leads** in a single batched API call to Claude with the tag definitions embedded in the system prompt.
3. Claude returns a structured JSON response assigning one or more tags per observation, drawn strictly from the predefined active tag list.
4. Tags are saved immediately. Confirmation shown: "3 observations tagged."
5. Newly tagged observations are immediately available in the analysis chart (Journey 2).

**Post-condition:** All of this district's untagged observations are tagged. District lead can slice activity data across any dimension without waiting for admin intervention.

**Admin global run:** Admin can separately trigger a global tagging sweep from the Tag Definitions page that processes all untagged observations across all districts. This is useful for bulk catch-up runs and does not conflict with district-level runs — any already-tagged observations are skipped.

---

## User Journey 4: Admin — Managing Tag Definitions

**Steps:**
1. Admin navigates to "Tag Definitions" in webapp settings.
2. Admin sees a list of all tags — active and retired — each with name, plain-language description, and status.
3. Admin can edit a description, add a new tag, or retire an existing one.
4. Retired tags remain visible on past observations for historical analysis but are marked retired and excluded from future tagging runs.
5. Changes take effect from the next "Auto-tag Now" run.

**Initial tag list (to be seeded on setup):**
- `group_formation` — Forming or reviewing a women's self-help group
- `training_life_skills` — Weekly training session on life skills
- `training_literacy` — Weekly training session on literacy skills
- `training_livelihood_skills` — Weekly training session on livelihood skills
- `kitchen_garden` — Setting up or reviewing a kitchen garden
- `livelihood_planning` — Planning household livelihoods (target: 2 per household)
- `input_purchase` — Helping household purchase inputs or assets with government funds
- `livelihood_setup` — Setting up the livelihood (infrastructure, equipment, etc.)
- `livelihood_execution` — Training or supporting household in running the livelihood
- `livelihood_profit` — Reviewing or supporting profit generation from the livelihood
- `scheme_documents` — Helping household prepare documents for government schemes
- `scheme_application` — Helping household apply for government schemes
- `scheme_benefit_tracking` — Checking if household has received scheme benefits

---

## User Journey 5: Admin — Uploading the Hierarchy Map

**Pre-condition:** Admin has a CSV with mandatory columns: `state | district | block | block_lead_email | field_worker_name | village_name`. No column may be blank. Optional `action` column accepts `upsert` (default) or `remove`.

**Unique key:** `state + district + block + field_worker_name + village_name` (handles duplicate village/block names across geographies).

**Steps:**
1. Admin navigates to "Hierarchy Management" in webapp settings.
2. Admin downloads the CSV template if needed.
3. Admin uploads the completed CSV.
4. System validates the file — flags missing columns, blank mandatory fields, malformed rows — and shows a preview of changes.
5. Admin confirms. System merges: new rows added, existing rows (matched by composite key) updated, rows marked `remove` retired.
6. Block lead app dropdowns and district lead filters reflect the updated mapping on next sync.

---

## User Journey 6: Admin — Managing User Roles

**Steps:**
1. Admin navigates to "User Management" in webapp settings.
2. Admin sees a list of existing users with roles and linked geographies.
3. Admin adds a new user: enters Google account email, assigns role (block lead / district lead / state lead / admin), links to geography (block / district / state as appropriate).
4. User logs in via Google SSO and lands in the experience for their role. No special invite needed.
5. Admin can edit or revoke roles at any time.

---

## User Journey 7: State Lead — Aggregated Cross-District View

**Steps:**
1. State lead logs in and lands on a dashboard aggregating data across all districts in their state.
2. Same frequency chart as district lead with an additional "district" dimension. Default: "observations by district, this month."
3. Can cross-cut by any combination of: district / block lead / village / tag / period.
4. Can drill into a specific district to see that district's view (identical to district lead view).
5. GPS validity flags visible at all drill-down levels.

---

## Technical Requirements

### Android App (Block Lead)
- Offline-first: all observations saved locally, synced when connectivity returns
- Speech-to-text input supporting Hindi and English
- Camera photo attachment (multiple photos per observation)
- GPS acquisition starts on form open; status indicator shown near Submit; coordinate captured at submit time from resolved fix
- Dropdown: field worker (filtered to this block lead) → village (filtered to selected field worker)
- Data preloaded on last sync: field worker → village mapping

### Web App (District Lead, State Lead, Admin)
- Google SSO authentication
- Single frequency chart with dimension dropdowns (tag / village / block lead / period + combinations)
- GPS flag display: ✅ / 🚩 per observation, adjustable radius (default 2km)
- **District lead "Auto-tag Now":** scoped to her district's block leads only — `POST /api/observations/tag?district=<name>`. Count shown before the button reflects only her district's untagged observations.
- **Admin global "Auto-tag Now":** no district filter — processes all untagged observations across all districts. Located on the Tag Definitions admin page.
- Tag definitions management page (add / edit / retire, retired tags preserved on historical data)
- Hierarchy CSV upload with validation, preview, and merge logic
- User management: assign roles + geographies

### AI Tagging
- Model: Claude Haiku 4.5 (via Anthropic API)
- Observations chunked into groups of 200 and processed sequentially; chunking is invisible to the user
- Tag definitions (name + description) pulled dynamically from the database and embedded in the system prompt at run time
- Response format: structured JSON — one record per observation with one or more tags
- Tags drawn strictly from the active predefined list
- Estimated cost: ~$1–2/month per district at typical observation volumes

---

## Deferred (Post-MVP)
- Auto-computation of village GPS coordinates from accumulated observations
- Manual tag override by district lead
- Block lead notification for GPS-flagged observations
- Retroactive re-tagging of past observations when tag definitions change