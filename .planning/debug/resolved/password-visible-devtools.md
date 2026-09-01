---
status: resolved
trigger: "Пароль отправляется в незашифрованном виде (например в этом запросе https://on-hands-git-gsd-phase-06-auth-bca434-careeremit-9861s-projects.vercel.app/api/auth/sign-in/email)"
created: 2026-09-01T16:34:15Z
updated: 2026-09-01T16:55:40Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

bug_class: bohrbug
hypothesis: "Confirmed: the reported browser DevTools behavior is expected local observability, not plaintext network transport; the password is encrypted by TLS after DevTools renders the POST body."
test: "Completed: compare HTTP and HTTPS behavior, inspect the complete application auth path for credential escape, and inspect installed Better Auth password handling."
expecting: "Observed: HTTP redirects permanently to HTTPS; HTTPS sends HSTS; app code keeps passwords in POST JSON; Better Auth hashes them with scrypt and omits password fields from output."
next_action: "Archive the confirmed no-code resolution and record the prevention pattern in the debug knowledge base."

reasoning_checkpoint:
  hypothesis: "The password's visibility in the browser owner's DevTools is local pre-TLS inspection, while the deployed endpoint uses TLS-protected transport and Better Auth safely handles the credential server-side."
  confirming_evidence:
    - "Earlier direct header checks observed an HTTP 308 redirect to HTTPS and HSTS on the HTTPS endpoint."
    - "The complete application auth path sends the password only in the required POST JSON body, and the installed Better Auth implementation hashes it with scrypt."
  falsification_test: "A successful HTTP response carrying auth data without redirect, absent HTTPS/HSTS protection, or a verification result showing the password in a URL/response body would disprove the resolution."
  fix_rationale: "No client-side transformation can hide a locally entered password from the browser owner; retaining TLS transport and server-side hashing directly satisfies the stated security requirement."
  blind_spots: "The local DevTools UI cannot be inspected programmatically; an external end-to-end check is still required in the reporter's workflow."
  candidate_causes:
    - "code: application code could have placed passwords in URLs, logs, or responses"
    - "config: deployment could have permitted unencrypted HTTP transport"
  and_gate: "no — either a client-side credential leak or insecure transport would independently violate the requirement; both have direct negative evidence."

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: |
  Choose and verify a secure authentication design for login and registration. Credentials
  must be protected in transit, must not leak into URLs or logs, and passwords must be
  handled and stored safely on the server.
actual: |
  The plaintext password is visible locally in the browser DevTools Request Payload for
  POST /api/auth/sign-in/email (and the corresponding registration flow).
errors: none
reproduction: |
  Open /login or /register, enter credentials, submit the form, and inspect the auth request
  in browser DevTools.
started: This has always behaved this way.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-09-01T16:36:00Z
  checked: "Knowledge base and symptom classification"
  found: "No local debug knowledge base exists. The behavior is deterministic and concerns browser request inspection, so it is classified as a Bohrbug. Relevant common-pattern candidates are data transport/API contract and environment/config (HTTPS enforcement)."
  implication: "Start with deterministic inspection of the transport boundary and deployed headers; do not treat a local DevTools view as proof of network exposure."

- timestamp: 2026-09-01T16:37:00Z
  checked: "Auth-path inventory"
  found: "Login and registration call better-auth client methods with the entered password; the sole server route delegates /api/auth/[...all] to better-auth. A dedicated auth-security verification script already asserts that passwords occur only in the POST request body and not in URLs or response bodies."
  implication: "The client must transmit a password to authenticate. The next differentiator is whether HTTPS/TLS is actually enforced for the reported deployment and whether any application code logs or serializes it outside the request body."

- timestamp: 2026-09-01T16:38:00Z
  checked: "Reported Vercel preview and complete auth client/server implementation"
  found: "The reported URL is HTTPS and returns strict-transport-security: max-age=63072000; includeSubDomains; preload. Login and registration send the password only as the JSON POST body through better-auth; the route delegates directly to better-auth and contains no logging or URL construction with credentials."
  implication: "TLS protects the request in transit. The locally visible DevTools payload is rendered before browser TLS encryption, so it cannot establish plaintext-on-the-network exposure."

- timestamp: 2026-09-01T16:40:00Z
  checked: "HTTP downgrade path, password sinks, and installed Better Auth implementation"
  found: "The HTTP version of the reported endpoint responds with a 308 redirect to HTTPS. Repository-wide credential-sink inspection found no application logging of auth input and the auth-security script verifies password absence from URLs and response bodies. Better Auth's installed password module uses node:crypto scrypt and its account-output parser omits the password field."
  implication: "The transport layer prevents network plaintext exposure, application code does not expose the credential outside the required request body, and server-side storage/output handling uses a hash rather than returning the password."

- timestamp: 2026-09-01T16:40:00Z
  checked: "SBFL eligibility"
  found: "No failing automated test exists for the reported behavior; the behavior itself is expected in browser DevTools."
  implication: "Spectrum-based fault localization is inapplicable; there is no faulty code location to rank."

- timestamp: 2026-09-01T16:47:00Z
  checked: "Regression suite and deployed transport headers"
  found: "The repository test suite passed: 35 files, 366 tests passing, 2 skipped. A bounded HTTP request to the reported deployment returned 308 with the equivalent HTTPS Location. The HTTPS response returned Strict-Transport-Security with max-age=63072000, includeSubDomains, and preload. The preview is currently Vercel SSO-gated (HTTPS 302), so automated sign-in against that deployment cannot be run unauthenticated."
  implication: "The no-code resolution remains supported by fresh transport evidence and repository regression coverage; the SSO gate is an external access limitation, not evidence of insecure credential handling."

- timestamp: 2026-09-01T16:55:40Z
  checked: "Reporter end-to-end verification"
  found: "The reporter confirmed the behavior is fixed/acceptable in their normal workflow and requested that the session be closed."
  implication: "The no-code security resolution is accepted end-to-end and can be archived."

## Resolution

root_cause: "Misinterpretation of the browser DevTools Request Payload: it displays the plaintext application payload on the local client before TLS encryption. The deployment enforces HTTPS (HTTP 308 redirect plus HSTS), so this observation is not plaintext credential transport."
fix: "No application code change is required. Continue using HTTPS endpoints and never log, URL-encode, or cache passwords; do not add client-side password encryption or hashing as a transport substitute."
verification: |
  no_code_resolution: "Accepted design: TLS-protected transport with safe server-side handling. Client-side hashing/encryption must not be added merely to hide a locally entered password from its browser owner's DevTools."
  transport_recheck: "pass — fresh bounded requests observed HTTP 308 to HTTPS and HTTPS Strict-Transport-Security: max-age=63072000; includeSubDomains; preload."
  regression_suite: "pass — npm test: 35 files and 366 tests passed; 2 skipped."
  target_test: "skipped — the reported DevTools visibility is expected behavior, not a failing code path."
  mutation_check: "skipped — no code changed and no regression-test change is warranted."
  no_op_deletion: "pass — git diff contains no application-code change."
  adjacent_tests: "pass — full repository unit suite passed."
  revert_and_reconfirm: "skipped — no code change exists to revert; transport behavior was directly re-checked."
  guardrail_verdict: "accepted — no-code resolution; applicable checks passed or were explicitly inapplicable."
  limitation: "The Vercel preview is SSO-gated, preventing unauthenticated automated sign-in verification of that deployment."
files_changed: []

## Prevention

- **Blameless 5-Whys:**
  - **Code branch:** The browser displayed a submitted password because the authentication protocol necessarily carries the password in the local POST body before encryption. The observation was interpreted as a transport leak because DevTools renders application-layer data before TLS. The app avoids the actual code-level leak class by keeping credentials out of URLs, logs, and responses.
  - **Configuration branch:** Transport could have been insecure if HTTP were accepted. The deployed endpoint instead redirects HTTP to HTTPS and supplies HSTS; this was not immediately visible from the DevTools payload alone.
  - **AND-gate:** No. Either an actual code-level credential sink or insecure transport would independently be a security defect; neither was observed.
- **Why not caught:** No gate existed for this specific misunderstanding class; existing auth-security tests and deployment-header checks already cover the underlying credential-handling and transport requirements.
- **Recurrence guard:** Knowledge-base pattern in `.planning/debug/knowledge-base.md` plus the existing auth-security verification script: future reports of a password appearing in DevTools must first distinguish local pre-TLS inspection from URL/log/response leakage and verify HTTPS enforcement.
