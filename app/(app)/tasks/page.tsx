"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Copy, Filter, Link2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TaskPriorityBadge } from "@/components/tasks/task-priority-badge";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";
import { SampleDataBadge } from "@/components/sample-data-badge";
import { useTasks } from "@/hooks/use-tasks";
import { TASK_STATUSES, type Task, type TaskStatus } from "@/types";
import { placeholderTasks } from "@/lib/placeholder";
import {
  cn,
  formatDateTime,
  formatEffort,
  isOverdue,
} from "@/lib/utils";

const STATUS_LABEL: Record<TaskStatus, string> = {
  draft: "Draft",
  reminder: "Reminder",
  active: "Active",
  pending: "Pending",
  closed: "Closed",
};

function StatusPill({ status }: { status: Task["status"] }) {
  if (status === "closed") {
    return (
      <span className="inline-flex items-center rounded-md bg-success-50 px-2 py-0.5 text-theme-xs font-medium text-success-700">
        CLOSED
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center rounded-md bg-warning-50 px-2 py-0.5 text-theme-xs font-medium text-warning-700">
        PENDING
      </span>
    );
  }
  return <span className="text-theme-xs text-gray-400">—</span>;
}

function TasksTable({ tasks, loading }: { tasks: Task[] | undefined; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  if (!tasks || tasks.length === 0) {
    return (
      <div className="px-6 py-16 text-center text-theme-sm text-gray-500">
        No tasks here yet.
      </div>
    );
  }

  const copyLink = async (id: string) => {
    try {
      const url = `${window.location.origin}/tasks/${id}`;
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="border-b border-gray-200 dark:border-gray-800">
          <tr className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
            <th className="px-6 py-3">Task Name</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3">Priority</th>
            <th className="px-3 py-3">Est. Effort</th>
            <th className="px-3 py-3">Action Date</th>
            <th className="px-3 py-3">Notification</th>
            <th className="px-3 py-3">Deadline</th>
            <th className="px-6 py-3">Client</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 text-theme-sm dark:divide-gray-800">
          {tasks.map((t, idx) => (
            <tr
              key={t.id}
              className="group transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40"
            >
              <td className="px-6 py-3">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/tasks/${t.id}`}
                    className="font-medium text-gray-900 hover:underline dark:text-white"
                  >
                    {t.title}
                  </Link>
                  <span className="text-theme-xs text-gray-400">
                    · #{idx + 1}
                  </span>
                  <Link
                    href={`/tasks/${t.id}`}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Open task"
                  >
                    <Link2 className="size-3.5 text-gray-400 hover:text-gray-600" />
                  </Link>
                  <button
                    onClick={() => copyLink(t.id)}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Copy link"
                  >
                    <Copy className="size-3.5 text-gray-400 hover:text-gray-600" />
                  </button>
                </div>
              </td>
              <td className="px-3 py-3">
                <StatusPill status={t.status} />
              </td>
              <td className="px-3 py-3">
                <TaskPriorityBadge priority={t.priority} />
              </td>
              <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                {formatEffort(t.est_effort_minutes)}
              </td>
              <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                {formatDateTime(t.action_date)}
              </td>
              <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                {formatDateTime(t.notification_at)}
              </td>
              <td
                className={cn(
                  "px-3 py-3",
                  isOverdue(t.deadline) && t.status !== "closed"
                    ? "font-medium text-error-600"
                    : "text-gray-700 dark:text-gray-300",
                )}
              >
                {formatDateTime(t.deadline)}
              </td>
              <td className="px-6 py-3 text-gray-700 dark:text-gray-300">
                {t.client?.name ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusTabs({
  value,
  onChange,
  counts,
}: {
  value: TaskStatus;
  onChange: (s: TaskStatus) => void;
  counts: Partial<Record<TaskStatus, number>>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {TASK_STATUSES.map((s) => {
        const active = s === value;
        return (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={cn(
              "rounded-full px-4 py-1.5 text-theme-sm font-medium transition-colors",
              active
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800",
            )}
          >
            {STATUS_LABEL[s]}
            {counts[s] != null && (
              <span
                className={cn(
                  "ml-1.5 text-theme-xs",
                  active ? "text-white/70" : "text-gray-400",
                )}
              >
                {counts[s]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function TasksContent() {
  const sp = useSearchParams();
  const clientId = sp.get("client_id") ?? undefined;

  const [status, setStatus] = useState<TaskStatus>("active");
  const [aiSearch, setAiSearch] = useState("");

  const tasksQuery = useTasks({ status, client_id: clientId });
  const allActive = useTasks({ client_id: clientId });

  const realData = allActive.data ?? [];
  const isPlaceholder = !allActive.isLoading && realData.length === 0;
  const sourceTasks: Task[] = isPlaceholder ? placeholderTasks : realData;

  const counts: Partial<Record<TaskStatus, number>> = {};
  for (const t of sourceTasks) {
    counts[t.status] = (counts[t.status] ?? 0) + 1;
  }

  const filteredByStatus = sourceTasks.filter((t) => t.status === status);
  const visibleTasks = isPlaceholder ? filteredByStatus : tasksQuery.data;
  const loading = isPlaceholder ? false : tasksQuery.isLoading;

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <StatusTabs value={status} onChange={setStatus} counts={counts} />
        <div className="flex items-center gap-2">
          {isPlaceholder && <SampleDataBadge />}
          <NewTaskDialog />
        </div>
      </div>

      <Card className="flex flex-1 flex-col overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-6 py-3 dark:border-gray-800">
          <div className="text-theme-sm text-gray-500">
            {visibleTasks?.length ?? 0} tasks
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Filter className="size-4" />
              Filter
            </Button>
            <div className="relative">
              <Sparkles className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-brand-500" />
              <Input
                value={aiSearch}
                onChange={(e) => setAiSearch(e.target.value)}
                placeholder="AI search..."
                className="h-8 w-56 pl-8 text-theme-sm"
              />
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <TasksTable tasks={visibleTasks} loading={loading} />
        </div>
      </Card>
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <TasksContent />
    </Suspense>
  );
}
