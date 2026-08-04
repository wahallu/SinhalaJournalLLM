export function Skeleton({ className = '', style }) {
  return <div className={`animate-shimmer rounded-md ${className}`} style={style} />;
}

export function SkeletonLines({ widths = [100, 92, 97, 60], lineClassName = 'h-3.5', className = '' }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {widths.map((w, i) => (
        <Skeleton key={i} className={lineClassName} style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

/**
 * Drop-in replacement for a spinning Loader2 icon — same footprint, but a
 * shimmer sweep instead of rotation. Used anywhere a button or inline action
 * needs a loading indicator without introducing a second, inconsistent
 * motion language alongside the skeleton shimmer used everywhere else.
 */
export function ShimmerDot({ size = 16, className = '' }) {
  return (
    <span
      className={`inline-block rounded-full animate-shimmer shrink-0 ${className}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}
