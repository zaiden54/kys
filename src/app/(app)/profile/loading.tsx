import { SkeletonLoader } from "@/components/skeleton-loader";

export default function ProfileLoading() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-12">
      <SkeletonLoader count={3} variant="payment-card" />
    </div>
  );
}
