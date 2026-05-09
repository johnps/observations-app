# ADR 0004 — React Native photo upload: native blob via fetch, raw REST POST

## Status
Accepted

## Context

The mobile app needs to upload compressed JPEG photos to Supabase Storage before posting an observation to the API. Several approaches were attempted and failed on Android (Samsung M21, React Native / Hermes):

**`supabase.storage.from(bucket).upload(path, blob)`** — fails with `Network request failed` when the blob is JS-constructed (`new Blob([...])`). The Supabase JS storage client's internal fetch cannot handle JS-constructed blobs as a request body on Android.

**`fetch(uploadUrl, { body: uint8Array })`** — throws at runtime: `Creating blobs from 'ArrayBuffer' and 'ArrayBufferView' are not supported`. React Native's networking stack does not support `ArrayBuffer` or `ArrayBufferView` as fetch body types.

**`File.bytes()` from expo-file-system v19** — returns a `Uint8Array`, which hits the ArrayBuffer constraint above. Not usable as a fetch body.

## Decision

Read the local file using `fetch('file://...').blob()`, which produces a **native React Native blob** backed by the native blob store. Native RN blobs are the only binary type that React Native's networking stack can use as a fetch body for uploads.

Upload using a direct fetch POST to the Supabase Storage REST API (not the JS client), with:
- The authenticated user's session JWT in the `Authorization` header (not the anon key — the bucket's RLS policy requires the `authenticated` role for INSERT)
- `x-upsert: true` so retries don't fail with "resource already exists"

```typescript
const fileRes = await fetchWithTimeout(uri, {});
const blob = await fileRes.blob();  // native RN blob

const { data: { session } } = await supabase.auth.getSession();
const authToken = session?.access_token ?? SUPABASE_ANON_KEY;

const uploadRes = await fetchWithTimeout(
  `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
    },
    body: blob,
  }
);
```

## Trade-offs

**Lost:** Using the Supabase JS storage client, which is the idiomatic API and would handle auth and URL construction automatically.

**Gained:** A pattern that actually works on Android. The raw REST call is straightforward and the Supabase storage REST API is stable.

## Consequences

- Do not switch back to `supabase.storage.upload()` — it silently fails on Android with JS blobs.
- Do not use `File.bytes()` or `ArrayBuffer` as fetch body — React Native will throw at runtime.
- The Supabase storage bucket must have an explicit INSERT policy for the `authenticated` role. A "public" bucket grants read access only — it does not permit writes from authenticated users without an RLS policy.
- `fetch('file://...').blob()` is the only reliable way to read a local file for upload in React Native. It produces a native blob that React Native's OkHttp-backed networking can handle as a request body.
