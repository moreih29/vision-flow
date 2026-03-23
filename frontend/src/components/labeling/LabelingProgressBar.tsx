interface LabelingProgressBarProps {
  labeled: number;
  total: number;
}

export default function LabelingProgressBar({
  labeled,
  total,
}: LabelingProgressBarProps) {
  const pct = total === 0 ? 0 : Math.round((labeled / total) * 100);

  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2 w-24 overflow-hidden rounded-full bg-muted">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        {labeled}/{total}
      </span>
    </div>
  );
}
