import { Badge } from "@/components/ui/badge";
import type { TaskPriority } from "@/types";

const STYLES: Record<TaskPriority, { variant: "secondary" | "warning" | "destructive"; label: string }> = {
  low: { variant: "secondary", label: "Low" },
  normal: { variant: "secondary", label: "Normal" },
  high: { variant: "warning", label: "High" },
  critical: { variant: "destructive", label: "Critical" },
};

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  const s = STYLES[priority] ?? STYLES.normal;
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
