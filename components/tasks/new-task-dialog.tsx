"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClients } from "@/hooks/use-clients";
import { useCreateTask } from "@/hooks/use-tasks";
import type { TaskPriority, TaskStatus } from "@/types";

export function NewTaskDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState<string>("none");
  const [status, setStatus] = useState<TaskStatus>("active");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [deadline, setDeadline] = useState<string>("");
  const [actionDate, setActionDate] = useState<string>("");
  const [notificationAt, setNotificationAt] = useState<string>("");
  const [effortHours, setEffortHours] = useState<string>("");
  const [effortMinutes, setEffortMinutes] = useState<string>("");

  const { data: clients } = useClients();
  const createTask = useCreateTask();

  const reset = () => {
    setTitle("");
    setDescription("");
    setClientId("none");
    setStatus("active");
    setPriority("normal");
    setDeadline("");
    setActionDate("");
    setNotificationAt("");
    setEffortHours("");
    setEffortMinutes("");
  };

  const submit = async () => {
    if (!title.trim()) return;
    const totalMinutes =
      (Number(effortHours) || 0) * 60 + (Number(effortMinutes) || 0);
    try {
      await createTask.mutateAsync({
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
      });
      toast.success("Task created");
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create task");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default">
          <Plus />
          New Task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to get done?"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details (optional)…"
              rows={3}
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
                placeholder="0"
                value={effortHours}
                onChange={(e) => setEffortHours(e.target.value)}
                className="w-24"
              />
              <span className="text-theme-sm text-gray-500">hours</span>
              <Input
                type="number"
                min={0}
                max={59}
                placeholder="0"
                value={effortMinutes}
                onChange={(e) => setEffortMinutes(e.target.value)}
                className="w-24"
              />
              <span className="text-theme-sm text-gray-500">minutes</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!title.trim() || createTask.isPending}
          >
            {createTask.isPending ? "Saving…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
