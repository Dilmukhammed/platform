type LoadingCardConfig = {
  titleWidth: string;
  itemHeight: string;
  itemCount: number;
  columns?: string;
};

type RoleAreaLoadingVariant = "teacher" | "student";

function SkeletonBlock({
  className,
}: {
  className: string;
}) {
  return <div className={`animate-pulse rounded bg-surface-muted ${className}`} />;
}

const loadingConfigs: Record<
  RoleAreaLoadingVariant,
  {
    subtitleWidth: string;
    previewTitleWidth: string;
    previewBodyWidth: string;
    previewActionWidth: string;
    primaryCards: LoadingCardConfig[];
    secondaryCards: LoadingCardConfig[];
  }
> = {
  teacher: {
    subtitleWidth: "w-96",
    previewTitleWidth: "w-40",
    previewBodyWidth: "w-72",
    previewActionWidth: "w-20",
    primaryCards: [
      { titleWidth: "w-44", itemHeight: "h-16", itemCount: 3 },
      { titleWidth: "w-36", itemHeight: "h-24", itemCount: 2, columns: "sm:grid-cols-2" },
    ],
    secondaryCards: [
      { titleWidth: "w-32", itemHeight: "h-12", itemCount: 3 },
      { titleWidth: "w-28", itemHeight: "h-14", itemCount: 2 },
    ],
  },
  student: {
    subtitleWidth: "w-80",
    previewTitleWidth: "w-36",
    previewBodyWidth: "w-64",
    previewActionWidth: "w-16",
    primaryCards: [
      { titleWidth: "w-44", itemHeight: "h-16", itemCount: 3 },
    ],
    secondaryCards: [
      { titleWidth: "w-28", itemHeight: "h-10", itemCount: 3 },
      { titleWidth: "w-32", itemHeight: "h-14", itemCount: 3 },
    ],
  },
};

function LoadingCard({
  config,
  className,
}: {
  config: LoadingCardConfig;
  className?: string;
}) {
  const items = Array.from({ length: config.itemCount }, (_, index) => index);

  return (
    <div className={`rounded-card border border-border bg-surface p-6 ${className ?? ""}`}>
      <SkeletonBlock className={`h-6 ${config.titleWidth}`} />
      <div className={`mt-4 grid gap-3 ${config.columns ?? ""}`}>
        {items.map((item) => (
          <SkeletonBlock key={item} className={`${config.itemHeight} w-full`} />
        ))}
      </div>
    </div>
  );
}

export function RoleAreaLoading({
  variant,
}: {
  variant: RoleAreaLoadingVariant;
}) {
  const config = loadingConfigs[variant];

  return (
    <section className="space-y-8" aria-busy="true" aria-live="polite">
      <div>
        <SkeletonBlock className="h-8 w-64" />
        <SkeletonBlock className={`mt-2 h-4 max-w-full ${config.subtitleWidth}`} />
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-raised p-4">
        <SkeletonBlock className="h-10 w-10 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonBlock className={`h-4 ${config.previewTitleWidth}`} />
          <SkeletonBlock className={`h-3 max-w-full ${config.previewBodyWidth}`} />
        </div>
        <SkeletonBlock className={`h-8 ${config.previewActionWidth}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {config.primaryCards.map((card, index) => (
            <LoadingCard key={`primary-${index}`} config={card} />
          ))}
        </div>

        <div className="space-y-4">
          {config.secondaryCards.map((card, index) => (
            <LoadingCard key={`secondary-${index}`} config={card} />
          ))}
        </div>
      </div>
    </section>
  );
}
