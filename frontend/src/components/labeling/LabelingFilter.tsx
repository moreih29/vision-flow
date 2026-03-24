import { cn } from "@/lib/utils";
import { useLabelingStore, type LabelingFilter } from "@/stores/labeling-store";

const OPTIONS: { value: LabelingFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "unlabeled", label: "미라벨" },
  { value: "labeled", label: "라벨링됨" },
];

export default function LabelingFilter() {
  const { filter, setFilter } = useLabelingStore();

  return (
    <div className="flex items-center rounded-md border bg-muted/30 p-0.5 gap-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          className={cn(
            "rounded px-2 py-1 text-xs font-medium transition-colors",
            filter === opt.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setFilter(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
