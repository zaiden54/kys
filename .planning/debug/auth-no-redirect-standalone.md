---
status: diagnosed
trigger: "UAT G-04-2: After installing as a standalone PWA, the user remains able to log back in and sees their data — this UAT check failed. При попытке войти или зарегистрироваться ничего не происходит, данные отправляются на сервер, однако редиректа на главный экран не происходит."
created: 2026-08-31T14:50:04Z
updated: 2026-08-31T15:06:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

bug_class: Bohrbug (deterministic — reproduces every time per user report, both flows, no
  intermittency mentioned)

hypothesis: |
  CONFIRMED. login/page.tsx and register/page.tsx call authClient.signIn.email() /
  signUp.email() then immediately router.push("/") or router.push("/onboarding") with no
  router.refresh() and no reactive session invalidation in between. Both destinations are
  gated by a server-side session check ((app)/layout.tsx's getSessionUser()+redirect("/login")
  and session.ts's requireUserId()). Next.js App Router's client-side soft navigation
  (router.push) can resolve against cached/still-not-yet-fresh dynamic segment data for the
  target route instead of forcing a truly fresh server read of the just-set session cookie,
  so the navigation re-resolves back through the same unauthenticated gate instead of
  committing to the authenticated page -- reading to the user as "nothing happens" (they
  stay on what looks like the same login/register screen). This is a well-documented,
  common Better Auth + Next.js App Router gotcha; the framework's own bundled App Router
  auth guide (node_modules/next/dist/docs/01-app/02-guides/authentication.md) demonstrates
  the alternative canonical pattern -- signing in via a Server Action that calls
  next/navigation's redirect() directly -- which does not have this failure mode.

reasoning_checkpoint:
  hypothesis: "router.push() after a client-side Better Auth sign-in/sign-up, with no
    router.refresh()/session-state invalidation, allows the App Router's client navigation
    to resolve the destination route against stale pre-auth data, so the server-side session
    gate re-fires and the user never visibly leaves the login/register screen"
  confirming_evidence:
    - "Direct HTTP test: POST /api/auth/sign-up/email correctly returns Set-Cookie
      (better-auth.session_token, HttpOnly, SameSite=Lax); a subsequent full-page GET / with
      that cookie returns 200 (authenticated) not a 307 to /login -- server-side session
      recognition itself is provably correct, isolating the defect to the client navigation
      step, not cookie/session mechanics."
    - "git diff 5e3c5fa..HEAD -- login/page.tsx shows phase 04's only change is the
      isStandalone hook + hint JSX block; onSubmit/router.push logic is byte-identical to
      the original 01-02 tracer commit (db14032). register/page.tsx has zero commits since
      db14032. Both pages share the identical router.push-without-refresh anti-pattern
      independently, explaining why BOTH flows are reported broken."
    - "Both existing test layers have a structural blind spot for this exact failure: the
      jsdom render test (login/page.render.test.tsx) mocks next/navigation's useRouter
      entirely ({push: vi.fn()}) and never asserts it was called or that navigation
      committed; scripts/verify-auth-flow.mjs (phase 01's E2E auth check) drives the raw
      HTTP API directly via node fetch with a manually-managed cookie header, never
      exercising LoginPage/RegisterPage, router.push, or the client Router Cache at all."
    - "STATE.md's own Blockers/Concerns log records that browser-based manual UAT of this
      exact flow was never performed until this Phase 04 UAT (Phase 3 and Phase 4 notes both
      flag 'not click-through-performed' / 'no physical iPhone available') -- this is the
      first real-browser exercise of this code path since it was written."
    - "next.config.ts's Serwist config (exclude:[/.*/], globPublicPatterns:[], no
      runtimeCaching array) produces an empty precache with no route matching; Serwist's own
      handleFetch/setDefaultHandler code comments confirm 'without a default handler,
      unmatched requests will go against the network as if there were no service worker
      present' -- ruling out SW interception as a contributing factor."
  falsification_test: "If a fresh router.refresh() were inserted immediately before
    router.push() (or the redirect were performed via a Server Action's redirect() instead
    of a client authClient call + router.push()) and the reported failure stopped occurring
    in a real-browser retest, that would confirm this mechanism. Conversely, if adding
    router.refresh() did NOT fix it, that would falsify this hypothesis and point back to
    something browser/device-specific this sandbox could not reproduce (no live browser
    available in this environment to directly instrument)."
  fix_rationale: "n/a for this session -- goal is find_root_cause_only; fix deferred to
    gsd-plan-phase --gaps."
  blind_spots: "Could not drive a real browser (claude-in-chrome unavailable, no Playwright
    installed) to directly observe the client Router Cache/RSC navigation in action, so the
    exact internal mechanism (stale Router Cache entry vs. some other client-side state
    staleness) is inferred from code inspection + well-documented ecosystem pattern-matching
    + process of elimination, not directly instrumented. A curl-based simulation of the RSC
    soft-navigation headers produced an inconclusive/noisy result (an infinite _rsc=
    cache-buster redirect loop occurring identically for both authenticated and anonymous
    requests) that was not trustworthy as real evidence and was discarded rather than
    over-interpreted."
  candidate_causes:
    - "code: router.push() called immediately after client-side Better Auth sign-in/sign-up
      with no router.refresh()/cache invalidation, in both login/page.tsx and
      register/page.tsx (independently, same anti-pattern)"
    - "config: Next.js App Router default client Router Cache / dynamic-segment staleness
      behavior interacting with the session-gated (app) layout -- a framework-default
      behavior the code never explicitly accounts for (not a project config override)"
  and_gate: "no -- the missing router.refresh()/invalidation step alone is sufficient to
    explain the full observed symptom (both login and register, deterministically, per the
    user's report); no second independent condition is required to reproduce it"

test: "Direct HTTP simulation (curl + cookie jar) of sign-up -> Set-Cookie -> authenticated
  full-page GET / to isolate server-side session recognition from client-side navigation"
expecting: "If server-side session recognition were broken, authenticated GET / would
  redirect to /login even with a valid cookie. It did not (200, correct authenticated body) --
  isolating the fault to the client navigation step."
next_action: "Hand off to /gsd-plan-phase --gaps for a targeted fix plan (goal:
  find_root_cause_only -- no fix applied in this session)"

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: |
  User logs in (or registers) with test credentials, and is redirected to the home screen
  (next payment card, pie chart, install banner hidden).
actual: |
  При попытке войти или зарегистрироваться ничего не происходит, данные отправляются на
  сервер, однако редиректа на главный экран не происходит.
  (Nothing happens on submit — data is sent to server, but no redirect to home screen occurs.)
errors: none reported explicitly by user; investigate console/server logs
reproduction: |
  Test 2 in 04-UAT.md: attempt login or registration via app's auth forms.
  Reported to affect BOTH login and registration flows.
  Discovered specifically in standalone-PWA-launch context (Test 2 = standalone app launch
  and re-login), but user report doesn't explicitly rule out non-standalone (Safari tab) repro.
started: Discovered during UAT for Phase 04. Phase 04 touched login/page.tsx (re-login hint),
  layout.tsx (manifest/viewport metadata), and PWA/service-worker config. Registration page
  reportedly untouched by phase 04 but also affected -- suggests shared root cause or
  pre-existing bug.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: "Phase 04 introduced a regression in the auth/session code (session.ts,
    auth.ts, auth-client.ts, or middleware) that broke login/register redirects."
  evidence: "git diff 5e3c5fa..HEAD (pre-phase-04 -> HEAD) for
    src/app/layout.tsx, next.config.ts, src/lib/auth.ts, src/lib/auth-client.ts,
    src/lib/session.ts shows zero changes to auth.ts/auth-client.ts/session.ts. No
    middleware.ts exists in the project at all. next.config.ts's phase-04 change (Serwist
    SW registration) and layout.tsx's change (viewport/appleWebApp metadata) are unrelated
    to session/cookie handling. login/page.tsx's phase-04 diff is purely additive (isStandalone
    hook + hint JSX); register/page.tsx has no phase-04 commits at all yet is also reported
    broken -- rules out a phase-04-introduced regression."
  timestamp: 2026-08-31T15:05:00Z

- hypothesis: "Better Auth session cookie is not being recognized server-side (wrong
    SameSite/Secure attribute, CORS/Origin rejection, or a session-lookup bug) after a
    successful client sign-in/sign-up."
  evidence: "Direct HTTP test against a running dev server: POST /api/auth/sign-up/email
    (with Origin header) returned 200 with Set-Cookie:
    better-auth.session_token=...; HttpOnly; SameSite=Lax; Max-Age=2592000. A subsequent
    plain GET / using that cookie returned 200 with the authenticated (app) layout body
    (not a 307 to /login). Session/cookie recognition is provably correct at the HTTP layer."
  timestamp: 2026-08-31T15:05:00Z

- hypothesis: "The newly added Serwist service worker (phase 04) intercepts and mishandles
    the POST /api/auth/* request or the subsequent navigation to '/', breaking the redirect
    in standalone/production mode specifically."
  evidence: "src/app/sw.ts registers Serwist with precacheEntries: self.__SW_MANIFEST
    (kept empty by next.config.ts's exclude:[/.*/] + globPublicPatterns:[]) and no
    runtimeCaching routes registered. node_modules/serwist/dist/index.mjs's own
    setDefaultHandler doc comment confirms: 'Without a default handler, unmatched requests
    will go against the network as if there were no service worker present.' With an empty
    precache and no runtime routes, essentially every request (including the auth POST and
    the '/' navigation) falls through untouched to the network. This does not rule out every
    conceivable SW interaction but strongly de-prioritizes it as the primary cause, especially
    since the user reports BOTH login and register affected, and register's flow is identical
    in shape/timing to login's."
  timestamp: 2026-08-31T15:05:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-08-31T14:53:00Z
  checked: "POST http://localhost:3000/api/auth/sign-up/email with Origin header, via curl"
  found: "200 OK, Set-Cookie: better-auth.session_token=...; Max-Age=2592000; Path=/;
    HttpOnly; SameSite=Lax. Response body contains valid user JSON."
  implication: "Sign-up API + cookie issuance works correctly outside any client JS/router
    involvement."

- timestamp: 2026-08-31T14:53:02Z
  checked: "GET http://localhost:3000/ with the sign-up cookie attached, via curl"
  found: "200 OK, full authenticated HTML for the (app) layout (not a redirect to /login)."
  implication: "Server-side session gate ((app)/layout.tsx -> getSessionUser() ->
    redirect('/login')) correctly recognizes a valid session cookie on a fresh request.
    Rules out a server-side cookie/session-recognition bug."

- timestamp: 2026-08-31T14:56:00Z
  checked: "src/app/(auth)/login/page.render.test.tsx and scripts/verify-auth-flow.mjs
    (Phase 01's E2E auth check)"
  found: "login/page.render.test.tsx mocks `next/navigation`'s useRouter as
    `{ push: vi.fn() }` and never asserts push was called with '/' nor that any navigation
    committed -- it only tests the re-login hint's conditional rendering.
    verify-auth-flow.mjs drives raw HTTP endpoints via node fetch with a manually-managed
    Cookie header (never renders LoginPage/RegisterPage, never calls authClient, never
    calls router.push)."
  implication: "Neither existing automated test layer exercises the real
    'submit form -> authClient call -> router.push -> land on target page' path. This
    explains why the bug has never surfaced before this UAT's first real click-through."

- timestamp: 2026-08-31T14:58:00Z
  checked: "git log --follow + git diff for src/app/(auth)/login/page.tsx and
    src/app/(auth)/register/page.tsx across all phase-04 commits"
  found: "login/page.tsx's only phase-04 diff (commit 4e67671) adds useIsStandalone() +
    a conditional hint <div>; onSubmit/router.push('/') is byte-identical to the original
    Phase 01-02 tracer commit (db14032). register/page.tsx has received zero commits since
    db14032 -- phase 04 never touched it."
  implication: "The redirect-after-auth code path is pre-existing since Phase 1, unmodified
    by Phase 04. Rules out a Phase-04 regression; this is a dormant bug newly surfaced by
    the first real-browser UAT of this flow."

- timestamp: 2026-08-31T15:00:00Z
  checked: "node_modules/next/dist/docs/01-app/02-guides/authentication.md (this project's
    pinned Next.js version's own bundled App Router auth guide, per AGENTS.md's mandate to
    read it before writing auth code)"
  found: "The canonical App Router pattern shown redirects via a Server Action calling
    next/navigation's redirect('/profile') directly (server-side redirect), not via a
    client component calling router.push() after a client-side auth SDK call. This
    project's login/register pages use the latter (client-side) pattern instead."
  implication: "The project deviates from the framework's own documented canonical pattern
    for the exact class of operation (post-auth redirect) that is failing; the deviation
    (client-side router.push with no cache/session-state invalidation) is a known-fragile
    pattern for Better Auth + Next.js App Router specifically (corroborated by web search --
    see below)."

- timestamp: 2026-08-31T15:02:00Z
  checked: "Web search: 'better-auth signIn.email router.push not redirecting Next.js App
    Router'"
  found: "Community consensus / documented fix: call router.refresh() immediately before
    router.push() (or perform the redirect inside Better Auth's onSuccess callback) after
    a client-side signIn.email()/signUp.email() call, specifically to invalidate the App
    Router's client-side cache of the destination route so it re-reads the freshly-set
    session cookie rather than resolving from stale pre-auth data."
  implication: "This project's onSubmit handlers (both login and register) do neither --
    they call router.push() directly with no router.refresh() and no onSuccess callback --
    matching the exact anti-pattern the ecosystem has already identified and documented a
    fix for."

- timestamp: 2026-08-31T15:03:00Z
  checked: "node_modules/serwist/dist/index.mjs (Serwist's Route/handleFetch/
    setDefaultHandler implementation) against src/app/sw.ts and next.config.ts's Serwist
    config"
  found: "precacheEntries is forced empty (exclude:[/.*/] + globPublicPatterns:[]) and no
    runtimeCaching routes are registered anywhere in the SW. Serwist's own documentation
    comment confirms unmatched requests fall through to the network untouched."
  implication: "The Phase-04-added service worker is very unlikely to be intercepting or
    altering the auth POST or the '/' navigation fetch in a way that would explain this
    bug -- further de-prioritizing a PWA/standalone-specific mechanism in favor of the
    plain client-navigation-cache explanation, which applies equally in a normal browser
    tab."

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: |
  Both src/app/(auth)/login/page.tsx and src/app/(auth)/register/page.tsx call Better
  Auth's client SDK (authClient.signIn.email() / authClient.signUp.email()) and then
  immediately call router.push("/") / router.push("/onboarding") with no router.refresh()
  (or equivalent session-state invalidation, e.g. an onSuccess-callback-based redirect)
  in between. The destination routes are gated by a server-side session check
  ((app)/layout.tsx's getSessionUser()+redirect("/login") and session.ts's
  requireUserId()->redirect("/login")). Next.js App Router's client-side soft navigation
  (router.push) does not, by itself, force the router to treat the destination as needing
  a fully fresh server read reflecting the just-changed auth cookie -- a well-documented
  Better Auth + Next.js App Router gotcha -- so the navigation can re-resolve back through
  the same unauthenticated redirect-to-/login gate instead of committing to the
  authenticated page. From the user's perspective this reads as "nothing happens": they
  remain on what looks like the same login/register screen even though the API call
  itself succeeded and the session cookie was correctly issued.
  This is pre-existing since the Phase 01-02 tracer commit (db14032) -- unmodified by
  Phase 04 -- and was never caught before because neither existing test layer exercises
  this real client-navigation path (the jsdom render test mocks useRouter entirely; the
  Phase 01 verify-auth-flow.mjs script drives raw HTTP endpoints directly, bypassing the
  React client components and router.push altogether). This Phase 04 UAT's manual
  click-through is the first real-browser exercise of this code path.
fix: (not applicable — goal is find_root_cause_only; deferred to /gsd-plan-phase --gaps)
verification: (not applicable — goal is find_root_cause_only)
files_changed: []
