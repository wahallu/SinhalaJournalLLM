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
