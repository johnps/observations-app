# ADR 0005 — Session is the authority for user identity, not URL parameters

## Status

Accepted

## Context

The district lead page was originally navigated to with a `?district=` URL parameter so the page knew which district to filter observations by. This worked when district names were stable, but created two problems:

1. **Mutable routing key.** District names can change in the backend. A URL built from a district name becomes a stale or broken route if the name changes. A session-derived value (the user's email) never changes.

2. **Spoofable identity.** A URL parameter representing user identity can be manually edited in the address bar. Deriving identity from the authenticated session is the only safe source of truth.

The same concern applies to any role-gated page: the state lead page had no session check at all — it relied on the fact that only the state lead knew the URL.

## Decision

**User identity and role are always derived from the authenticated session, never from URL parameters.**

- Pages that require a specific role call `getSessionRole()` on mount and redirect to `/` if the session is absent or the role doesn't match.
- The district filter for the district lead page is derived from `session.district_name` (returned by `/api/users/role`), not from a URL param.
- The only legitimate use of URL params for district is the state lead drill-down (`?district=...&from=state-lead`), where the state lead is authenticated separately and the district param is a navigation convenience, not an identity claim.

## Consequences

- Adding a new role-gated page requires a session check on mount (pattern: `getSessionRole()` → redirect on mismatch → guard data loads until resolved).
- District lead cannot be deep-linked to a specific district via URL — the district always comes from their account. This is intentional.
- `web/lib/getSessionRole.ts` is the single place that combines session lookup and role fetch. All pages use it rather than calling `supabase.auth.getSession()` directly.
