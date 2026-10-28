// Instant navigation fallback for every (app) route without its own
// loading.tsx. Mirrors the home screen's layout (avatar row, focal amount,
// quick actions, cards) so nothing shifts when the real page streams in.
// (Rare accepted mismatch on /onboarding.)
export default function AppLoading() {
  const block = "skeleton-pulse bg-[color:var(--color-tertiary-surface)]";
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col px-4 py-4" role="status" aria-live="polite">
      <span className="sr-only">Загрузка…</span>
      <div className="flex items-center gap-3">
        <div className={`${block} size-10 rounded-full`} />
        <div className={`${block} h-4 w-32 rounded-full`} />
      </div>
      <div className="flex flex-col items-center gap-4 pt-10 pb-6">
        <div className={`${block} h-7 w-56 rounded-full`} />
        <div className={`${block} h-12 w-48 rounded-2xl`} />
        <div className={`${block} h-4 w-64 rounded-full`} />
      </div>
      <div className="flex justify-between px-1 pb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex w-[72px] flex-col items-center gap-2">
            <div className={`${block} size-[52px] rounded-full`} />
            <div className={`${block} h-3 w-12 rounded-full`} />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2.5">
        <div className={`${block} h-48 rounded-[var(--radius-card)]`} />
        <div className={`${block} h-[72px] rounded-[var(--radius-card)]`} />
        <div className={`${block} h-[72px] rounded-[var(--radius-card)]`} />
      </div>
    </div>
  );
}
