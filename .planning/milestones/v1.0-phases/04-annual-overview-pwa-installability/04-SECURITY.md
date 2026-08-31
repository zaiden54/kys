---
phase: 04
slug: annual-overview-pwa-installability
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-31
---

# Phase 04 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Neon DB → annual summary server action | Payroll rows are aggregated only after session-derived user scoping. | Private payroll data; only aggregate totals leave the server action. |
| Server Component → AnnualPieChart | The browser receives gross, tax, net, and estimated-baseline state, not raw payroll rows. | User-specific aggregate financial totals. |
| Anonymous browser → PWA metadata/icon routes | Manifest and icons are intentionally public and accept only bounded rendering input. | Public metadata and generated icon images. |
| Browser APIs → install/login UI | Standalone detection and dismissal state are read locally without network transfer. | Non-sensitive device/UI state. |
| Post-auth browser → server session gate | Client refresh/navigation updates UX; server-side session checks remain authoritative. | Session cookie evaluated by the protected server route. |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-04-01 | Information Disclosure | `computeAnnualSummary` | high | mitigate | Session-derived `userId` scopes every repository query; cross-user isolation is covered by `annual-summary.test.ts`. | closed |
| T-04-02 | Denial of Service | `AnnualPieChart` malformed/zero summary | low | accept | Rendering uses a fixed two-slice dataset and guards zero gross values, so input magnitude does not amplify render work. | closed |
| T-04-SC-01 | Tampering | `recharts` dependency | high | mitigate | Audited dependency is locked through `package-lock.json` at the planned 3.10.1 line. Normalized from duplicate plan ID `T-04-SC`. | closed |
| T-04-03 | Denial of Service | `GET /api/pwa-icon` | medium | mitigate | The route maps all input to exactly 192 or 512 pixels; route tests cover bounded behavior. | closed |
| T-04-04 | Tampering | Service worker | medium | mitigate | Serwist excludes all build assets and the generated worker uses an empty precache manifest, preventing authenticated response caching. | closed |
| T-04-05 | Information Disclosure | Install banner and re-login hint | low | accept | Only same-origin browser state is read; no PII or third-party transfer occurs. | closed |
| T-04-SC-02 | Tampering | `serwist` / `@serwist/next` dependencies | high | mitigate | Audited dependencies are locked through `package-lock.json` at the planned 9.5.12 line. Normalized from duplicate plan ID `T-04-SC`. | closed |
| T-04-03-01 | Elevation of Privilege | Login/register navigation timing | low | accept | Client refresh/push cannot authorize access; protected routes still enforce the server-side session gate. | closed |
| T-04-03-02 | Denial of Service | One refresh after successful authentication | low | accept | Exactly one RSC refresh occurs per successful auth event, with no request amplification path. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-04-01 | T-04-02 | Fixed-size chart work and an explicit zero-value guard make residual render risk negligible. | Phase plan | 2026-08-31 |
| AR-04-02 | T-04-05 | Local standalone/dismissal signals contain no payroll data or PII and never leave the browser. | Phase plan | 2026-08-31 |
| AR-04-03 | T-04-03-01 | Navigation timing affects UX only; server authorization remains authoritative. | Gap-closure plan | 2026-08-31 |
| AR-04-04 | T-04-03-02 | A single refresh per successful authentication has negligible residual availability impact. | Gap-closure plan | 2026-08-31 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-31 | 9 | 9 | 0 | Codex / `gsd-secure-phase` L1 artifact verification |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-31
