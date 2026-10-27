# Saved Searches (Smart Collections) — Test Plan

**Product:** Pics.io DAM · **Feature area:** Search & organise → Saved Searches · **Author:** Maksym Nyrka · **Version:** 1.0 · **Date:** 2026-10-27

| | |
|---|---|
| **Scope** | UI and API testing of Saved Searches: filter panel, save dialog, the Searches tree, and the endpoints behind them |
| **Out of scope** | Every other testing type and product area — see §3 |
| **Companion artefact** | Playwright/TypeScript suite in this repository (`tests/`), implementing the automated subset in §5 |
| **Status** | Written after a hands-on session on Pics.io web 8.23.1, 27 Oct 2026 |

---

## 1. Summary

Saved Searches in Pics.io are **Smart Collections**: a saved set of filters that behaves like a folder whose contents update themselves. A user builds a query in the filter panel, clicks the save-search icon in the filter bar, names the collection in the **Create saved search** dialog, optionally drops it into a group and optionally shares it with the team; it then lives under the **Searches** tree and returns live results every time it is opened.

I chose this feature because it sits on the product's central promise — *find the right asset* — and because its failures are **silent**. A broken upload shouts; a search that quietly omits 30 of 400 matching assets looks perfectly healthy and erodes trust in the whole library. That combination (high blast radius, low observability) is exactly where testing earns its keep.

The plan is prioritised rather than exhaustive: 24 scenarios split into core and secondary, with automation focused on the core set. Everything is scoped to UI and API testing.

**What can go wrong**

1. **Wrong results** from filter/operator combinations (AND/OR/negation, ranges, "is not set").
2. **Stale results** — a Smart Collection that does not reflect a metadata change, or reflects it after an undefined delay.
3. **State loss** — criteria not surviving rename/move/reload, or orphaned entries after deletion.
4. **Contract drift** — a payload or status code changes and a client breaks without anyone noticing.

---

## 2. Documented behavior

Source: Pics.io Help Center, May 2026.

- Any combination of filters — type, filename, keywords, description, colour, rating, share status, person, comment text, embedded EXIF/IPTC, custom `meta.*` fields — can be saved.
- Saving offers a name, a location (Personal root, Team root, or an existing group/subgroup), and a **Share with my team** toggle that defaults the location to Team root.
- Collections are organised in a tree with groups and subgroups, **maximum 5 levels**; duplicate names inside the same parent are rejected.
- Groups are a *visual* layer only — a group is not executable and children do not inherit filters.
- Each collection can be favourited (pinned), sorted by name or creation date, renamed inline, moved, and deleted (group deletion cascades with confirmation).
- Built-in collections ship by default: Duplicates (MD5-based), Restricted assets, by file type, by date, assigned to you; plus team-oriented ones (approved by / commented on by / uploaded by / assigned to).
- Access is via the magnifier (**Searches**) icon in the left panel; team collections follow team-saved-search permissions.

---

## 3. Scope

**In scope.** The UI and API of Saved Searches: the filter panel and its operators, the save dialog (name, location, share toggle, validation), the Searches tree (groups, nesting, rename, move, delete, favourites, sort), the empty, error and loading states around them, and the endpoints those screens call.

**Out of scope.** Everything else. This is a deliberate narrowing, not an oversight: no testing type outside UI and API, and no adjacent product area, is covered.

**How UI testing is covered.** Playwright drives the real interface against a seeded library: build a query, save it, find it in the tree, reopen it, run a different query and reopen again, delete it. Assertions are on what the user can see — tree contents, result counts, empty and error states — with a real pointer for hover-only actions and role-based locators (`treeitem`, `aria-expanded`, `data-id`) rather than generated class names.

**How API testing is covered.** Direct calls through Playwright's request context cover create, list, delete and search execution. Each response is asserted for status, shape (zod) and persisted state, including error bodies. The API also seeds and cleans fixtures, and acts as the oracle for UI result sets: the same query is executed through the screen and through the endpoint, and the returned IDs must match.

**How the two fit together.** One fixture, two lenses. The API proves the contract; the UI proves a user can reach the same state through the product. When they disagree, the failing layer tells us where the bug is.

---

## 4. Scenarios

24 scenarios in two groups. Core covers the journey users repeat and the API contracts that make it true; secondary covers the edges that protect it.

**Why core.** If any of these fail, the feature is wrong or unusable — and usually silently. They cover save → open → re-run → delete, plus the calls that make each step true.

**Why secondary.** They protect the core from the sides: validation, nesting, ordering, operators, unicode and error paths. A failure here is narrower or more visible, so these are checked by hand rather than on every pull request.

### Core scenarios

| ID | Layer | Scenario |
|---|---|---|
| TC-01 | UI | Save a single-term search → it appears in the tree → opening it returns the same result set |
| TC-02 | UI | Save a multi-filter search (type + filename) → criteria round-trip exactly |
| TC-03 | UI | Reload / new session → collection and its results are identical |
| TC-04 | UI | Reopen a collection after another search → it re-runs its own query, not the last result set |
| TC-05 | UI | A zero-result search saves and opens with an explicit empty state, not an error or a spinner |
| TC-06 | UI | Delete a collection → gone from the tree, gone after reload, no orphaned entry |
| TC-07 | API | `POST /savedSearches` stores the exact filter payload and returns the created node |
| TC-08 | API | `GET /savedSearches` returns that node with the same criteria |
| TC-09 | API | Duplicate name in the same location → 409 with a structured error code |
| TC-10 | API | `DELETE /savedSearches/:id` removes the node; a repeat delete is a clean 404 |
| TC-11 | API | `POST /images/search` executes the saved criteria and returns the expected set — the oracle for TC-01/02 |
| TC-12 | API | Create-time validation rejects a filter payload the search endpoint cannot execute (4xx, nothing stored) — observed: currently 201, then 500 on open |

### Secondary scenarios

| ID | Layer | Scenario |
|---|---|---|
| TC-13 | UI | Rename inline; duplicate name in the same parent rejected with a clear message |
| TC-14 | UI | Create group/subgroup, nest to 5 levels; the 6th attempt is blocked with the limit explained |
| TC-15 | UI | Move a collection between groups → filters and results unchanged |
| TC-16 | UI | Delete a non-empty group → confirmation names the impact; children removed |
| TC-17 | UI | Favourite pins to top; sort by name and creation date is stable |
| TC-18 | UI | Reload / back-forward restores results but loses the saved-search identity — observed: the URL carries filters, not `savedSearchId` |
| TC-19 | API | Operator semantics: Is All Of vs Is Any Of vs Is None Of vs Is Not Set |
| TC-20 | API | Date operators (Today / Last 7 days / Range) at boundaries, including timezone |
| TC-21 | API | Multiple filenames in one filter (space-separated, per the docs) |
| TC-22 | API | Unicode, emoji and 255+ character names stored and returned intact |
| TC-23 | API | Built-in collections (Duplicates, Restricted, by type/date, assigned to me) return plausible sets |
| TC-24 | API | Replaying a create returns 409 and leaves one node; error bodies match the documented shape |

---

## 5. Automation strategy

**Automation is limited to the core scenarios.** They are the ones that carry the risk — save, open, re-run, delete, and the API contracts that make each step true — and time is finite, so the effort goes into a small suite that is trusted rather than a broad one that is skimmed. The rule: a test earns automation when it is deterministic, cheap to run, and expensive to miss; anything that needs human judgement or a retry to pass stays out.

| Layer | Automated | Why these |
|---|---|---|
| UI | <span class="nw">TC-01 to TC-06</span> | The journey every user repeats, end to end: save, reopen, re-run, empty state, delete. Visible outcomes, no timing dependence. |
| API | <span class="nw">TC-07 to TC-12</span> | Contracts and negatives are cheaper and more reliable through the API; TC-11 doubles as the oracle for UI result sets. |

**Why not the rest.** The secondary scenarios stay manual for now.

**Shape**

```
API client + fixtures  →  helpers: seed and clean test data, no assertions
      ↓
UI E2E                 →  browser tests: save, open, re-run, empty state, delete
      ↓
API contract tests     →  endpoint tests: payload shape, statuses, error codes, oracle
```

**Selectors.** Role + accessible name first (`getByRole('treeitem')`), `data-id` for identity, `data-testid` only where the app already provides it. Tree items are matched on their own label (`:scope > …`), because a group's node also contains every child name. Never generated CSS Modules classes or `nth-child` chains. Tree actions render only on hover, so they must be driven with a real pointer rather than a synthetic click.

**Assertions.** Assert the visible outcome *and* cross-check the result set through the API. No `waitForTimeout`; web-first assertions only; `expect.poll` for result counts, because rendering trails the response.

**Test data.** A namespaced fixture (`qa-<runId>-`) seeded through the API, unique per run, torn down in a fixture. UI tests use the library that ships with the workspace (one asset whose filename contains "bottles", one zero-result query) so assertions stay readable. The 50 built-in collections ship with the workspace, so tree-scale tests need no generation.

**Auth.** `storageState` captured once out-of-band and refreshed when it expires; no login UI in tests.

**CI**

| Trigger | Content | Budget |
|---|---|---|
| Pull request | Automated suite, Chromium | ≤ 5 min |
| Nightly | Automated suite | ≤ 20 min |
| Release | Nightly + exploratory charter + risk review | — |

Artifacts: HTML report, trace on first retry, video on failure.

---

## 6. Tools

| Need | Tool | Note |
|---|---|---|
| UI automation | Playwright + TypeScript | `@playwright/test`, Chromium project |
| API / contract | Playwright `request` + zod | Fast negatives; no UI dependency |
| Data seeding | Pics.io API | Keeps fixtures deterministic and fast |
| CI / reporting | GitHub Actions + HTML reporter | Traces and videos as artifacts |
| Test management | Markdown in-repo + GitHub Issues | `TC-*` IDs are the traceability key |
| AI assistance | Claude Code | Reads the docs and issue tracker, drafts test cases, writes and reviews the auto-tests, opens PRs and keeps documentation current |

**AI — Claude Code**

Claude Code is the AI tool in this workflow, used as the working assistant across the whole cycle. What that means concretely:

- **Connects to the documentation** — reads the Pics.io Help Center pages directly, so §2 reflects what the product documents rather than recollection.
- **Navigates documentation and issues** — traces a reported symptom back to the doc section or the open issue it relates to before a repro is written.
- **Connects to the issue tracker** — scenarios and findings link to real tickets; nothing lives only in this document.
- **Creates test cases** — drafts the scenario tables from documented behaviour plus the hands-on session; every expectation is verified by hand against the fixture.
- **Creates, updates and reviews auto-tests** — writes and refactors the Playwright suite, and reviews each diff for flaky patterns (sleeps, brittle locators, shared state) before a PR is opened.
- **Creates pull requests** — small, single-purpose PRs with the test report and traces attached.
- **Creates documentation** — this plan, the suite README and the coverage map are drafted and kept current through it.

---

## 7. Metrics and benchmarks

Thresholds below are **hypotheses to calibrate** after the first runs, not commitments invented in advance.

| Metric | Target | How measured |
|---|---|---|
| Core scenarios passing on `main` | 100% | CI |
| Flake rate | < 2% over 20 consecutive runs | Retry telemetry, reviewed on every nightly run |
| Result correctness | 0 mismatches on 50 sampled queries | UI vs API oracle |
| API schema failures | 0 | zod validation on every response |
| API call time (create / list / search) | Every call under 2 s in CI | Playwright request timing; a slower call fails the run |
| API coverage of the UI's endpoints | 100% | Every endpoint the UI calls has at least one API test |
| Escaped defects per release (search area) | Trend down; 0 S1/S2 | Bug tracker |
| Core scenarios covered by automation | 100% | Coverage map |

During the session, `GET /savedSearches` returned the 50 built-in nodes in ~2.4 KB, and `POST /images/search` returned 4–7 KB for four assets. Both are small enough that fixtures stay cheap, and the built-ins give the tree realistic scale without generation.

---

## 8. Communicating results

**Two layers: this plan (stable) and a release report (per release)**

- **This plan** is the stable layer — scope, scenarios, strategy. It changes when the feature or the strategy changes, not when a release ships.
- **The release report** (`docs/releases/<version>.md`, created from `_template.md`) is the repeating layer: for one release, the suites and cases that ran — automated and manual — with results, open findings, risks, and an explicit go/no-go recommendation. The automated half is filled straight from the CI run; only the manual rows need a human.

Each release report carries a frozen **coverage map** — scenario ID → automated/manual → result for that release — so "is this covered?" is one lookup, and coverage growth is visible across the sequence of reports. Reports reference `TC-*` IDs and record only what is true for that release; scenario definitions live in this plan and nowhere else, so the reports cannot drift apart from it.

- **Bug report**: title = user-visible symptom; environment; minimal repro; expected vs actual; evidence (trace/video/screenshot); impact and severity; suspected area. No "steps: 1. open app".

**Severity**

| Level | Definition | Example |
|---|---|---|
| S1 | Data loss | Deleting a group also removes collections outside it |
| S2 | Silently wrong results / core journey blocked | Filter combination omits matching assets |
| S3 | Degraded but workable | Rename fails until reload |
| S4 | Cosmetic | Misaligned tree icon |

**Cadence and audience**

- Daily: async note in the ticket — what was tested, what broke, what is blocked.
- Daily standup: 5-minute sync with the team — testing progress since yesterday, ongoing issues, and anything blocking the build.
- Weekly: 15-minute quality review with dev + PM on the open issues and flake trend.
- Pre-release: one-page readiness note, 24 h ahead, with a clear recommendation.
- Devs get traces and precise repro; PM gets risk and user impact; support gets known issues and workarounds; leadership gets the one-pager.

**Definition of done for a finding:** reproducible, isolated to the smallest step set, evidenced, and with impact stated in user terms. A bug that cannot be reproduced is a question, not a bug.
