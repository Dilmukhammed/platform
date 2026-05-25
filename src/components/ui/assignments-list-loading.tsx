type AssignmentsListLoadingVariant = "teacher" | "student";

function SkeletonBlock({
  className,
}: {
  className: string;
}) {
  return <div className={`animate-pulse rounded-lg bg-surface-muted ${className}`} />;
}

export function AssignmentsListLoading({
  variant,
  filterCount,
}: {
  variant: AssignmentsListLoadingVariant;
  filterCount?: number;
}) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      {variant === "teacher" ? (
        <div className="flex items-center justify-between">
          <SkeletonBlock className="h-8 w-48" />
          <SkeletonBlock className="h-10 w-32" />
        </div>
      ) : (
        <div className="flex gap-2">
          {Array.from({ length: filterCount ?? 5 }, (_, index) => (
            <SkeletonBlock key={index} className="h-10 w-20" />
          ))}
        </div>
      )}

      <div className="rounded-card border border-border bg-surface p-0">
        <div className="space-y-4 p-4">
          {Array.from({ length: 3 }, (_, index) => (
            <SkeletonBlock key={index} className="h-20 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
