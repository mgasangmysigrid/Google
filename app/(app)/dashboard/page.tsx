"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TaskPriorityBadge } from "@/components/tasks/task-priority-badge";
import { SampleDataBadge } from "@/components/sample-data-badge";
import { useTasks } from "@/hooks/use-tasks";
import { placeholderTasks } from "@/lib/placeholder";
import { formatDate } from "@/lib/utils";

function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function isToday(d: Date) {
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

function within(days: number, d: Date) {
  const ms = days * 24 * 60 * 60 * 1000;
  const diff = d.getTime() - Date.now();
  return diff >= 0 && diff <= ms;
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
          {icon}
        </div>
        <div>
          <div className="text-theme-sm text-gray-500 dark:text-gray-400">
            {label}
          </div>
          <div className="text-title-sm font-semibold text-gray-900 dark:text-white">
            {value}
          </div>
          {hint && (
            <div className="text-theme-xs text-gray-400">{hint}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0] ?? "";
  const { data: realTasks, isLoading } = useTasks({ status: "active" });

  const isPlaceholder = !isLoading && (realTasks?.length ?? 0) === 0;
  const tasks = isPlaceholder
    ? placeholderTasks.filter((t) => t.status === "active")
    : (realTasks ?? []);

  const todayTasks = tasks.filter(
    (t) => t.deadline && isToday(new Date(t.deadline)),
  );
  const criticalTasks = tasks.filter(
    (t) => t.priority === "critical" || t.priority === "high",
  );
  const upcomingDeadlines = tasks.filter(
    (t) => t.deadline && within(3, new Date(t.deadline)),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-title-md font-semibold text-gray-900 dark:text-white">
            {greeting()}
            {firstName ? `, ${firstName}` : ""}.
          </h1>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            Here&apos;s what&apos;s happening today.
          </p>
        </div>
        {isPlaceholder && <SampleDataBadge />}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <>
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </>
        ) : (
          <>
            <StatCard
              icon={<ClipboardList className="size-4" />}
              label="Tasks today"
              value={todayTasks.length}
              hint="Due before midnight"
            />
            <StatCard
              icon={<AlertTriangle className="size-4" />}
              label="Critical & high"
              value={criticalTasks.length}
              hint="Active priority items"
            />
            <StatCard
              icon={<CalendarClock className="size-4" />}
              label="Upcoming (3 days)"
              value={upcomingDeadlines.length}
              hint="Across all clients"
            />
          </>
        )}
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Critical &amp; high priority
            </h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/tasks">
                View all
                <ArrowRight />
              </Link>
            </Button>
          </div>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : criticalTasks.length === 0 ? (
            <p className="py-4 text-theme-sm text-gray-500">
              Nothing critical right now.
            </p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-800">
              {criticalTasks.slice(0, 6).map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/tasks/${t.id}`}
                    className="flex items-center gap-3 py-3 transition hover:bg-gray-50 dark:hover:bg-gray-800/40"
                  >
                    <CheckCircle2 className="size-4 text-brand-500" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-gray-900 dark:text-white">
                        {t.title}
                      </div>
                      {t.deadline && (
                        <div className="text-theme-xs text-gray-500">
                          Due {formatDate(t.deadline)}
                          {t.client?.name && ` · ${t.client.name}`}
                        </div>
                      )}
                    </div>
                    <TaskPriorityBadge priority={t.priority} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
