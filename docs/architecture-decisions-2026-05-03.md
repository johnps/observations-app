# Architecture Decisions — Plain Language
*From the grilling session on 2026-05-03*

---

## What this is

We reviewed five problems in the codebase and made a decision about how to fix each one. This document explains what each problem is, why it matters, and what we decided — in plain English.

---

## Problem 1: The observation "shape" was a secret shared by four files

**What was happening**

When a field worker submits an observation, the app packages it up as a blob of data (id, text, location, photos, etc.) and saves it to the device. That blob has a specific shape — specific fields with specific names. But nowhere in the code was that shape written down as a rule. Four different files each independently *assumed* the same shape. If one file got it wrong, or if we ever changed the shape, there was no single place that would catch the mistake.

Think of it like four colleagues all independently writing down a customer's address from memory, with no shared address book.

**What we decided**

Create one file — `mobile/types/observation.ts` — that formally defines what an observation looks like. Every other file imports from there. The database layer (`db.ts`) is responsible for packing and unpacking the data; no other file ever touches the raw format.

---

## Problem 2: The sync process was lying about what it was doing

**What was happening**

The app syncs saved observations to the server in the background. To avoid two syncs running at the same time, it uses a lock — "if a sync is already running, don't start another one." But when it skipped because of the lock, it returned the same response as "nothing to sync." The rest of the app couldn't tell the difference.

It also had a function called `_resetSyncLock` that existed purely for automated tests. Exposing internal plumbing through a side door like that is a sign the design has a hole in it.

**What we decided**

When a sync is skipped because one is already running, say so explicitly — add a `skipped: true` flag to the response. Close the side door (`_resetSyncLock`) and use a standard testing technique (`jest.resetModules`) to get a clean slate between tests instead.

---

## Problem 3: The observation form was doing work that was already being done elsewhere

**What was happening**

When the form loads, it fetches the list of field workers and villages to populate the dropdowns. But the app already fetches and caches that same data when it starts up (via `syncHierarchy`). So there were two independent systems doing the same job — and the form's version was less reliable (no timeout, no retry).

**What we decided**

Delete the form's fetch logic entirely. Create a `useHierarchy` hook — a small reusable piece of code — that just reads the already-cached data. The form asks "give me the field workers and villages for this block lead," and the hook looks it up from the local cache. One fetch path, not two.

---

## Problem 4: A library was exposing its internal steps instead of its result

**What was happening**

When an admin imports a CSV file of hierarchy data (states, districts, field workers, villages), the code that handles it was split into three steps: parse, preview, apply. The problem is that two separate parts of the system each had to call those steps themselves, in the right order. There was nothing stopping a caller from calling them in the wrong order, or skipping a step.

Think of it like a recipe that gives you the raw techniques (chop, sauté, deglaze) instead of just saying "make the sauce."

**What we decided**

Create two plain-language functions that each do the full job:
- `validateHierarchyCSV(csv)` — "check this file and tell me what would change"
- `applyHierarchyCSV(csv)` — "check this file and actually make the changes"

The internal steps (parse, preview, apply) become hidden. Callers just pick the function that matches what they want to do.

---

## Problem 5: Two apps were independently deciding where to send users after login

**What was happening**

After a user logs in, the app checks their role (admin, district lead, block lead, etc.) and sends them to the right screen. Both the mobile app and the web app had their own copy of this logic. The mobile app also had retry logic in case the role check failed — the web app didn't.

**Why we didn't over-engineer it**

The obvious fix is to share this logic between both apps. But mobile and web are genuinely doing different things: mobile just checks "are you a block lead? if not, you can't use this app." Web routes four different roles to four different places. They share one API call, but the decision-making is legitimately different.

Creating a shared code layer for this would be more complexity than the problem warrants.

**What we decided**

Keep the logic separate. Fix the one real gap: add retry logic to the web version so it's as reliable as mobile. Make the "you don't have a role" error message consistent across both.

---

## The bigger lesson

Most of these problems share a root cause: **logic that belongs in one place ended up scattered across several places.** The fixes all follow the same pattern — find the one place that should own a piece of knowledge, move it there, and have everything else ask that one place.

The other theme: **don't over-engineer.** A few of these problems had "correct" architectural solutions that would have added a lot of complexity for little real benefit. The right answer was often the simpler one.
