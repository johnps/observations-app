# Issue 0015 — Role-aware top nav bar on all web pages

## What to build

A persistent `TopNav` component that appears at the top of every web page. It renders the logged-in user's Google display name and email (from `session.user.user_metadata.full_name` and `session.user.email`), role-appropriate navigation links, and a sign-out button. The existing inline `SignOutButton` usage on each page is replaced by the nav bar's sign-out action.

Role-to-links mapping:
- `district_lead`: Observations (`/district-lead/observations`) | Map (`/district-lead/map`)
- `state_lead`: Overview (`/state-lead`)
- `admin`: Users (`/admin/users`) | Hierarchy (`/admin/hierarchy`) | Tags (`/admin/tags`)

The active link (matching the current pathname) is visually distinguished. `TopNav` is mounted on: district lead observations page, state lead page, admin home, admin users, admin hierarchy, admin tags. The map page (Issue 0018) will also mount it.

Session data for the nav bar is read via `supabase.auth.getSession()` in a client component — the same session already fetched by each page's role guard. No additional API call needed.

## Demoable as

Any web user can see their name, email, correct navigation links for their role, and a sign-out button at the top of every page, and can click a link to navigate without using the browser back button.

## Acceptance criteria

- [ ] `TopNav` renders the correct links for `district_lead`, `state_lead`, and `admin` roles
- [ ] `TopNav` does not render links for other roles (no cross-role link leakage)
- [ ] The active page link is visually distinguished from inactive links
- [ ] The user's Google display name and email are shown in the nav bar
- [ ] Clicking sign-out calls `supabase.auth.signOut()` and redirects to `/`
- [ ] `TopNav` is mounted on: district lead observations, state lead overview, admin home, admin users, admin hierarchy, admin tags
- [ ] Playwright test: district lead session sees "Observations" and "Map" links, does not see "Users"
- [ ] Playwright test: state lead session sees "Overview" link only
- [ ] Playwright test: admin session sees "Users", "Hierarchy", "Tags" links
- [ ] Playwright test: sign-out button is present on all pages and redirects to `/` on click

## Blocked by

None — can start immediately

## Status

Implemented
