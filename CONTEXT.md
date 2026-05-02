# Livelihood Monitor — Context

## What this programme is trying to do

This app supports a government-linked rural livelihood programme in India whose goal is to help poor households — primarily women — escape poverty by building sustainable livelihoods. The programme works at scale across villages, blocks, and districts. It is not enough to give households money; they need hand-holding over several years to form groups, build skills, set up livelihoods, and access government entitlements. The app exists to make that hand-holding visible and accountable.

---

## Who the beneficiaries are

Poor rural households, represented primarily by women. Each household is expected to have at least two livelihoods set up over the course of the programme. Households receive government funds to purchase inputs and assets. They need support not just with money but with skills, group formation, and navigating government schemes. Many are semi-literate or illiterate.

---

## Geography hierarchy

The administrative hierarchy in India used by this programme is:

```
State
└── District
    └── Block
        └── Village
            └── Household
```

- Several villages make up a block.
- Several blocks make up a district.
- Several districts make up a state.

**Important:** Village names, block names, and district names are not unique across India. The same name can appear in multiple blocks or districts. Any unique identifier for a village must therefore use the full composite: `state + district + block + village_name`.

---

## Domain vocabulary

**Field worker:** The frontline programme staff member. Manages 40 households spread across 5–6 villages. Responsible for all direct work with households: forming groups, training, livelihood setup, scheme access. Paid a stipend. Motivation varies — not all field workers visit their villages consistently.

**Block lead:** Supervises 25 field workers within a block. Responsible for monitoring whether field workers are doing their jobs. Does this by making field visits to villages and recording observations.

**District lead:** Supervises all block leads within a district. Reviews observations made by block leads to assess coverage and quality of field execution.

**State lead:** Oversees the programme across all districts in a state. Has a read-only aggregated view; no direct supervisory actions in this app.

**Admin:** Manages the system — uploads hierarchy data, manages user roles, maintains tag definitions.

**Self-help group (SHG):** A small group of women from programme households, typically 10–15 members. Formed by the field worker. The group meets regularly and is the primary unit through which training and activities are delivered.

**Livelihood:** An income-generating activity set up for a household. Each household is expected to have at least two. Types include:
- *Remunerative crops:* vegetables and other high-value crops
- *Livestock:* goats, pigs, poultry
- *Nano-businesses:* kirana shops (small grocery stores), vegetable vending, mini roadside restaurants, trading

**Training:** Field workers conduct weekly training sessions with SHG members over 3 years across three skill areas:
- *Life skills:* confidence, decision-making, communication
- *Literacy skills:* reading, writing, numeracy
- *Livelihood skills:* specific skills for the household's chosen livelihoods

**Kitchen garden:** A small vegetable garden set up at the household level, typically as an early, low-risk livelihood activity.

**Government scheme:** A government welfare programme that households may be eligible for — examples include housing schemes, insurance, pensions, and subsidies. Field workers help households get the required documents made, submit applications, and track whether benefits have been received.

**Observation:** A structured record made by a block lead during a field visit. Contains free-text notes (in Hindi, English, or a mix), photos, GPS coordinates, timestamp, and links to the field worker and village being observed.

**Tag:** A label assigned to an observation that categorises the activity being observed (e.g. `kitchen_garden`, `training_life_skills`, `scheme_application`). Tags are predefined and managed by admins. Used to analyse what activities are actually happening on the ground.

---

## User personas

### Field worker
Not a direct user of this app. Their work is the subject of observations made by block leads. Semi-literate in some cases. Works in villages with poor connectivity. Paid a stipend; visit frequency is not guaranteed.

### Block lead
Primary mobile app user. Works in the field, often in villages with poor or no internet connectivity. Uses an Android smartphone. Comfortable with basic smartphone usage but not technically sophisticated. Writes or speaks in Hindi, English, or a mix of both. Needs the app to work entirely offline and sync later. Has limited time in the field — the observation logging flow must be fast and require minimal taps.

### District lead
Primary web app user. Works from a district office on a desktop or laptop. Moderate technical comfort — familiar with spreadsheets and basic web tools. Needs to monitor multiple block leads across many villages. Wants to spot patterns quickly: who is visiting, what activities are happening, where GPS flags are appearing. Does not want to manually tag observations — prefers automation.

### State lead
Secondary web app user. Works from a state office. Wants a high-level view across districts to assess programme health. Does not manage block leads directly. Read-only consumer of aggregated data.

### Admin
Technical or programme management staff. Sets up and maintains the system: uploads the field worker to village hierarchy, manages user accounts and roles, maintains the tag definitions that drive AI tagging. Comfortable with CSV files and web-based admin interfaces.

---

## Operating constraints

**Connectivity:** Block leads work in rural villages where mobile internet is unreliable or absent. The Android app must be fully offline-capable — observations must be saveable locally and sync automatically when connectivity returns.

**Speech-to-text:** Uses `expo-speech-recognition` (Expo SDK 51+), which calls the Android `SpeechRecognizer` API directly. Locale set to `hi-IN` — handles Hinglish code-switching naturally without a language toggle. UX: microphone icon button inside the observation text area; tap to start, tap to stop (or auto-stops after 2s silence); live interim transcript appears in the text area as the user speaks; user can edit before submitting. No separate recording screen. No keyboard mic interaction. No on-device Whisper models.

**Language:** Block leads write and speak in Hindi, English, or a mix of both (Hinglish). The speech-to-text input and any text processing must handle this mix gracefully.

**Device:** Block leads use Android smartphones. The app is Android-only for now.

**GPS accuracy:** GPS coordinates are captured at the time of observation submission. Village-level GPS coordinates are not available from a preloaded dataset and inference from accumulated observations is post-MVP.

**Hierarchy sync:** The Android app silently pulls the latest field worker → village mapping on every app launch when online. No manual sync step. Stale data risk is limited to block leads who launch the app while offline without having opened it since a hierarchy change.

**GPS flag (MVP definition):** The ✅/🚩 flag on an observation indicates whether a GPS coordinate was captured at all — not proximity to the village. A present coordinate is ✅; a missing or zero coordinate is 🚩. This catches desk submissions (submitted without being physically present). When village-coordinate inference ships post-MVP, the flag meaning upgrades to proximity-based without a schema change.

**Literacy:** Some field workers and household members are semi-literate. This does not directly affect the app UI (block leads and district leads are the app users) but shapes what kinds of observations block leads write — they may be brief, colloquial, or inconsistently structured.

**Workforce motivation:** Field workers are stipend-paid and visit frequency is not guaranteed. A core purpose of this app is to surface non-visits and low activity — the system should make absence as visible as presence.

## Dashboard (web app)

**Frequency chart:** Bar chart. Primary dimension on X-axis, observation count on Y-axis. Default view: observations by block lead, current month. Zero-count entities shown as flat bars — absence must be as visible as presence. When period is the primary dimension, renders as grouped/stacked bars (time buckets on X, coloured by secondary dimension). No line charts in MVP.

**Period filter options:** Today, This week (Mon–Sun), This month (default), Last month, Custom range (date picker). No quarterly or annual views in MVP.

**State lead drill-down:** Clicking a district in the state view navigates to a dedicated district page (same component as the district lead dashboard, scoped to that district). Browser back returns to the state view. The district lead view is one shared component reused for both roles.

## Tech stack

- **Android app:** React Native with Expo — handles camera, GPS, and offline SQLite storage via Expo libraries. Distributed as a standard Android APK.
- **Web app:** Next.js (React) — serves both the district/state lead dashboard and admin pages.
- **Backend:** Next.js API routes — no separate backend service for MVP.
- **Database:** Supabase (PostgreSQL) — handles data storage, row-level security, and file storage for photos.
- **Photo storage:** Supabase Storage.
- **Hosting:** Vercel (Next.js web app) + Supabase (database and storage).

## Authentication

**Auth (deferred):** Full Google SSO with backend-issued 30-day JWT is the target architecture but is not built in MVP. All roles use the auth placeholder during initial development.

**Auth placeholder (MVP):** The login screen shows four buttons — Admin, District Lead, Block Lead, State Lead — each mapped to a pre-seeded placeholder identity (e.g. `test-admin@placeholder.local`). No text input, no real emails. These identities are seeded in the DB at deploy time with proper role and geography assignments. When testing is complete, all placeholder data is wiped with a single SQL command. When real auth ships, the placeholder screen is removed and replaced with Google SSO; placeholder DB accounts are deleted in a migration.

## Sync model

**Observation identity:** Every observation is assigned a UUID on the device at creation time. The server upserts on this UUID — duplicate syncs and multi-device syncs are both safe.

**Immutability:** Observations are append-only. Once submitted, they cannot be edited. This keeps sync simple and preserves audit integrity.

**Photos:** Max 5 photos per observation. Resized on-device to max 1280px on the long edge (~200–400KB each) before upload. Stored in Expo's local file system until the observation syncs; deleted from device after confirmed upload to Supabase Storage.

**Observation form field order (Android):** Field worker → Village → Observation text (with inline mic) → Photos → Submit. Field worker and village are captured first so context is set before writing. Easy to reorder later — no schema or API impact.

## AI tagging behaviour

**Batch size cap:** The "Auto-tag Now" call chunks observations into groups of 200 and processes them sequentially. Chunking is invisible to the user — they see a single spinner with an observation count. This is an internal implementation detail, not a user-facing concept.

**Tagging run:** A single user-initiated action that tags all untagged observations for a district. At run time, the system pulls all active tags and their descriptions from the database and constructs the Claude system prompt dynamically — no separate file or document. Claude returns structured JSON assigning one or more tags per observation from the active list only. Admin edits to tag descriptions take effect on the next run automatically.

**Model:** Claude Haiku 4.5. Sufficient for fixed-schema classification against a short predefined list. Upgradeable to Sonnet in one line if accuracy proves inadequate.

**API credit scope:** Claude (Anthropic API) is called only during a tagging run. No other part of the system uses the API. Estimated cost at Haiku 4.5 pricing: ~$0.10 for a 1,000-observation monthly run. Budget ~$1–2/month per district.