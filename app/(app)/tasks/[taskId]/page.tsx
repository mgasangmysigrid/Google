"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskPriorityBadge } from "@/components/tasks/task-priority-badge";
import { SampleDataBadge } from "@/components/sample-data-badge";
import {
  useCloseTask,
  useDeleteTask,
  useTask,
  useUpdateTask,
} from "@/hooks/use-tasks";
import { useClients } from "@/hooks/use-clients";
import { placeholderTasks } from "@/lib/placeholder";
import type { Task, TaskPriority, TaskStatus } from "@/types";

function toLocalInput(date: string | null) {
  return date ? date.slice(0, 16) : "";
}

export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = use(params);
  const router = useRouter();
  const taskQuery = useTask(taskId);
  const { data: clients } = useClients();
  const updateTask = useUpdateTask();
  const closeTask = useCloseTask();
  const deleteTask = useDeleteTask();

  const isLoading = taskQuery.isLoading;
  const realTask = taskQuery.data;
  const isPlaceholder = !isLoading && !realTask;
  const task: Task | undefined =
    realTask ??
    (isPlaceholder
      ? placeholderTasks.find((t) => t.id === taskId) ?? placeholderTasks[0]
      : undefined);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("active");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [clientId, setClientId] = useState<string>("none");
  const [deadline, setDeadline] = useState<string>("");
  const [actionDate, setActionDate] = useState<string>("");
  const [notificationAt, setNotificationAt] = useState<string>("");
  const [effortHours, setEffortHours] = useState<string>("");
  const [effortMinutes, setEffortMinutes] = useState<string>("");

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setStatus(task.status);
    setPriority(task.priority);
    setClientId(task.client_id ?? "none");
    setDeadline(toLocalInput(task.deadline));
    setActionDate(toLocalInput(task.action_date));
    setNotificationAt(toLocalInput(task.notification_at));
    if (task.est_effort_minutes != null) {
      setEffortHours(String(Math.floor(task.est_effort_minutes / 60)));
      setEffortMinutes(String(task.est_effort_minutes % 60));
    } else {
      setEffortHours("");
      setEffortMinutes("");
    }
  }, [task]);

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!task) return <div className="text-theme-sm text-gray-500">Task not found.</div>;

  const save = async () => {
    if (isPlaceholder) {
      toast.message("Sample data — connect a database to save changes");
      return;
    }
    const totalMinutes =
      (Number(effortHours) || 0) * 60 + (Number(effortMinutes) || 0);
    try {
      await updateTask.mutateAsync({
        id: task.id,
        input: {
          title: title.trim(),
          description: description.trim() || null,
          status,
          priority,
          client_id: clientId === "none" ? null : clientId,
          deadline: deadline ? new Date(deadline).toISOString() : null,
          action_date: actionDate ? new Date(actionDate).toISOString() : null,
          notification_at: notificationAt
            ? new Date(notificationAt).toISOString()
            : null,
          est_effort_minutes: totalMinutes > 0 ? totalMinutes : null,
        },
      });
      toast.success("Saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  };

  const close = async () => {
    if (isPlaceholder) {
      toast.message("Sample data — connect a database to close tasks");
      return;
    }
    try {
      await closeTask.mutateAsync(task.id);
      toast.success("Task closed");
      router.push("/tasks");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to close");
    }
  };

  const remove = async () => {
    if (isPlaceholder) {
      toast.message("Sample data — connect a database to delete tasks");
      return;
    }
    if (!confirm("Delete this task? This cannot be undone.")) return;
    try {
      await deleteTask.mutateAsync(task.id);
      toast.success("Task deleted");
      router.push("/tasks");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/tasks"
          className="inline-flex items-center gap-2 text-theme-sm text-gray-500 hover:text-gray-900 dark:hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Back to tasks
        </Link>
        <div className="flex items-center gap-2">
          {isPlaceholder && <SampleDataBadge />}
          <TaskPriorityBadge priority={task.priority} />
          {task.status !== "closed" && (
            <Button variant="outline" onClick={close}>
              <CheckCircle2 />
              Close
            </Button>
          )}
          <Button variant="outline" onClick={remove}>
            <Trash2 />
            Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="No client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No client</SelectItem>
                  {clients?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as TaskStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="reminder">Reminder</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as TaskPriority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="action-date">Action date</Label>
              <Input
                id="action-date"
                type="datetime-local"
                value={actionDate}
                onChange={(e) => setActionDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notification">Notification</Label>
              <Input
                id="notification"
                type="datetime-local"
                value={notificationAt}
                onChange={(e) => setNotificationAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deadline">Deadline</Label>
              <Input
                id="deadline"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Estimated effort</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={effortHours}
                onChange={(e) => setEffortHours(e.target.value)}
                className="w-24"
              />
              <span className="text-theme-sm text-gray-500">hours</span>
              <Input
                type="number"
                min={0}
                max={59}
                value={effortMinutes}
                onChange={(e) => setEffortMinutes(e.target.value)}
                className="w-24"
              />
              <span className="text-theme-sm text-gray-500">minutes</span>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={save} disabled={updateTask.isPending}>
              {updateTask.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
