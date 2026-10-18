# Deferred Items

## 08-02 (bonuses screen restyle)

- `src/app/layout.tsx(38,50): error TS2304: Cannot find name 'LayoutProps'` — pre-existing tsc error seen before Task 2, unrelated to this plan's files (`bonus-row.tsx`, `bonus-form.tsx`, `bonuses/page.tsx`); `git log -- src/app/layout.tsx` shows no commit from this plan touching that file. Self-resolved after running `npm run build` (triggered by attempting `test:e2e`), which regenerates `.next/types/**` (Next.js's ambient `LayoutProps` type source, not checked into git). `npx tsc --noEmit` was clean (exit 0) after Task 2. No action needed — recorded for traceability only.
  status: acknowledged
