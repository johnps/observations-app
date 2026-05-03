# Speech-to-Text — Deferred Requirement

## What to build

In-app voice recording in the mobile observation form. Block lead presses and holds a mic button, speaks, releases — audio is saved locally and transcribed asynchronously when connectivity resumes.

## User flow

1. Block lead opens observation form and presses the mic button
2. App records audio (up to 60 seconds) and saves it to local device storage
3. Observation is queued in SQLite with a pointer to the audio file (same offline queue as text observations)
4. On connectivity resume, sync process uploads audio to the server
5. Server sends audio to OpenAI Whisper API, receives transcribed text, updates the observation record
6. Next sync: block lead's app reflects the transcribed text

## Design decisions

- **Transcription service**: OpenAI Whisper API ($0.006/min, ~$600/year at 100k observations)
- **Offline-first**: audio recorded and queued offline; transcription happens on sync, not at submission time
- **Fallback**: block lead can still type manually; transcription fills in the text field after sync
- **Pending state**: observations show a "transcription pending" badge on the dashboard until text is filled in

## Device requirements

| Requirement | Spec |
|---|---|
| Storage | ~1MB per clip (AAC 64kbps, 60s); 50 queued clips ≈ 50MB |
| Connectivity | Any data connection to sync; 1MB upload on 3G ≈ 5 seconds |
| Android version | 8.0+ (already targeted) |
| Microphone | Built-in mic (standard on all Android devices) |
| Battery | Negligible impact |

## Cost

| Phase | Cost |
|---|---|
| Build / testing | ~$2–5 |
| 100,000 observations/year × 60s each | ~$600/year (~$50/month) |

## Open question

Block lead submits offline → goes offline for 3 days → district lead sees observation with blank text for 3 days until sync. Acceptable? Options:
- Accept it and show "transcription pending" badge (recommended)
- Require connectivity at submission time (defeats offline-first design)

## What exists today

The keyboard mic button (native Android/iOS dictation) works in the text field — block leads who know about it can already dictate. This requirement adds a dedicated in-app button with async transcription so it works reliably offline.
