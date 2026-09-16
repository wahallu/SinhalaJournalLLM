import { SkeletonLines } from './Skeleton';

/**
 * Suspense fallback for a lazily loaded route.
 *
 * Deliberately not the index.html splash: that one covers a cold start with
 * no shell painted yet. By the time a route chunk is being fetched the
 * sidebar and header are already on screen, so a full-screen overlay would
 * be a regression — it would hide chrome the user can already see.
 */
export default function RouteFallback() {
  return (
    <div className="w-full py-10" role="status" aria-live="polite">
      <span className="sr-only">Loading</span>
      <SkeletonLines widths={[38, 100, 92, 97, 64]} className="max-w-3xl" />
    </div>
  );
}
