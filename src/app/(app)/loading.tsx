import { SkeletonLoader } from "@/components/skeleton-loader";

// Instant navigation fallback for every (app) route without its own
// loading.tsx. Mirrors the home page's configured-state layout so there is no
// layout shift. (Rare accepted mismatch on /onboarding.)
export default function AppLoading() {
  return (
    <div className="flex flex-1 flex-col items-center gap-4 px-6 py-16 min-[1100px]:max-w-4xl">
      <div className="flex w-full flex-col gap-4 min-[1100px]:grid min-[1100px]:grid-cols-2 min-[1100px]:items-start">
        <SkeletonLoader count={1} variant="payment-card" />
        <SkeletonLoader count={1} variant="chart" />
      </div>
    </div>
  );
}
