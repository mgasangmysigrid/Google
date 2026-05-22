import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

export function SampleDataBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-warning-200 bg-warning-50 px-2 py-0.5 text-theme-xs font-medium text-warning-700 dark:border-warning-900/40 dark:bg-warning-900/20 dark:text-warning-300",
        className,
      )}
    >
      <Sparkles className="size-3" />
      Sample data
    </span>
  );
}
