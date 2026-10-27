# Saved Searches (Smart Collections) — QA take-home

Two deliverables for the Pics.io QA exercise:

| Part | What | Where |
|---|---|---|
| 1 | UI + API test plan for Saved Searches | [`docs/test-plan.md`](docs/test-plan.md) → rendered at [`docs/index.html`](docs/index.html) |
| 2 | Playwright + TypeScript suite automating the core scenarios | [`tests/`](tests) |

The plan is the source of truth; the suite implements the automated subset named in §5.

---

## Quick start

Requirements: Node 20+, a Pics.io account with at least one library.

```bash
npm install
npx playwright install chromium

cp .env.example .env      # then fill in PICS_EMAIL / PICS_PASSWORD
npm run auth              # captures a logged-in session into .auth/state.json
npm test                  # runs the whole suite
```

Useful subsets:

```bash
npm run test:ui           # TC-01 … TC-06
npm run test:api          # TC-07 … TC-12
npm run typecheck         # tsc --noEmit
npm run docs              # re-render docs/test-plan.md → docs/index.html
```

`npm test` re-runs the auth setup first, so an expired session is refreshed automatically. `npm run auth` does the same thing on its own.

---

## What the suite covers

Twelve tests, one per core scenario. IDs match the plan.

| ID | Layer | Test |
|---|---|---|
| TC-01 | UI | Save a single-term search → it appears in the tree → reopening returns the same set |
| TC-02 | UI | Save a multi-filter search (type + filename) → criteria round-trip exactly |
| TC-03 | UI | Reload → collection and results identical |
| TC-04 | UI | Reopen after another search → the collection re-runs its own query |
| TC-05 | UI | Zero-result search saves and opens with an explicit empty state |
| TC-06 | UI | Delete → gone from tree, gone after reload, gone from the API |
| TC-07 | API | `POST /savedSearches` stores the payload and returns the node |
| TC-08 | API | `GET /savedSearches` returns that node with the same criteria |
| TC-09 | API | Duplicate name → `409` + `SavedSearchDuplicateAtLocationApiError` |
| TC-10 | API | `DELETE` removes the node; repeat delete is a clean `404` |
| TC-11 | API | `POST /images/search` executes the saved criteria (oracle for UI counts) |
| TC-12 | API | Create-time validation rejects an unexecutable filter payload — **expected failure** |

**TC-12 is intentionally red.** On build 8.23.1 the create call accepts
`{ keywordsOperator: "nope" }` with `201`, and the saved search then fails with
`500` when opened. The test asserts the behaviour that *should* exist and is
marked `test.fail()`, so the run stays green while the defect stays visible.

---

## Layout

```
src/
  api/client.ts        thin wrapper over /savedSearches and /images/search; every call is timed
  api/schemas.ts       zod schemas for every response the suite depends on
  pages/               page objects, injected as fixtures:
    filter-panel.page.ts          search bar and filter chips
    save-search-dialog.page.ts    create-saved-search dialog
    searches-tree.page.ts         the Searches tree: open, delete
    results.page.ts               result grid, empty state, shell boot
  fixtures/test.ts     api client, page objects, run-scoped ids, seeding, automatic cleanup
tests/
  auth.setup.ts        one-time login → .auth/state.json
  api/saved-searches.spec.ts   TC-07 … TC-12
  ui/saved-searches.spec.ts    TC-01 … TC-06
docs/                  test plan (Markdown) + generated Pages render
```

---

## Decisions and trade-offs

**Only the core scenarios are automated.** The brief is time-boxed and the plan's
§5 names the automated subset. Secondary scenarios stay manual; automating them
would add breadth without adding trust.

**Auth never appears inside a test.** Logging in is a setup project that writes
`storageState`; specs start already signed in. Login flows are slow, captcha-prone
and irrelevant to the feature under test.

**The API is both subject and oracle.** UI tests compare the on-screen result set
with what the endpoint returns for the same criteria, so a mismatch points at the
layer that broke. API tests assert status, shape (zod) and persisted state.

**Test data is namespaced and self-cleaning.** Everything the suite creates is
prefixed `qa-<runId>-` and deleted in a fixture, including on failure. UI-created
collections are registered for cleanup right after they are saved.

**Waiting is explicit, never fixed.** No `waitForTimeout`. The page objects wait
for the app shell (`button` count), for the `/images/search` response, and for the
filter state to reach the URL before saving. Result counts use `expect.poll`,
because rendering trails the response.

**Every API call is timed.** The client records each request's duration, and the
create, list and search tests assert the plan's §7 budget — under 2 s — so a slow
call fails the run instead of being a number nobody watches.

**Locators survive the build.** `data-testid` where the product already ships it
(`savedSearchDelete`, `savedSearchCreateRootGroup-team`), `role="treeitem"` +
`data-id` for identity, and the item's own label for name matching. Tree items
are matched with `:scope > …` because a group node contains every descendant name —
a plain text filter silently matches the root.

### Two adaptations from the plan

Both are noted here rather than hidden, and the plan text was updated to match
what build 8.23.1 actually exposes.

- **TC-02** uses **type + filename** instead of type + keyword + date. The filter
  bar in 8.23.1 offers `Created at` through *Add filters*, but the chip has no
  value editor, so a date criterion cannot be set from the UI.
- **TC-04** verifies that reopening a collection **re-runs its own query** rather
  than restoring the last result set. A true metadata-driven live update needs an
  indexed mutation; the public API's `PATCH /images/:id` does not reliably
  re-index keywords or ratings, so asserting it would test the indexer's latency
  rather than the feature.

---

## AI tooling

**OpenCode**, **Codex**, **AntiGravity** and **Z.ai** were used for this challenge.
Together they helped implement the whole task end to end — the test plan, the
Playwright suite and the docs — and reviewed the result before it was finalised.

---

## Notes

- `.env` and `.auth/` are gitignored; credentials never enter the repo.
- The suite runs with `workers: 1` because every test shares one workspace and
  mutates the same saved-searches tree.
- Artifacts: HTML report, trace on first retry, video and screenshot on failure.
