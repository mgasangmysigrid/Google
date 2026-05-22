export type Client = {
  id: string;
  name: string;
  status: string;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  notes: string | null;
  created_at: string;
};

export type TaskStatus = "draft" | "reminder" | "active" | "pending" | "closed";
export const TASK_STATUSES: TaskStatus[] = [
  "draft",
  "reminder",
  "active",
  "pending",
  "closed",
];
export type TaskPriority = "low" | "normal" | "high" | "critical";

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  type: "main" | "subtask";
  priority: TaskPriority;
  assignee_id: string | null;
  client_id: string | null;
  parent_task_id: string | null;
  deadline: string | null;
  est_effort_minutes: number | null;
  action_date: string | null;
  notification_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  client?: Pick<Client, "id" | "name"> | null;
};

export type InboxStatus = "inbox" | "attached" | "ignored";

export type Communication = {
  id: string;
  gmail_thread_id: string | null;
  gmail_message_id: string | null;
  channel: "email";
  direction: "inbound" | "outbound" | null;
  subject: string | null;
  snippet: string | null;
  from_email: string | null;
  from_name: string | null;
  to_emails: string[] | null;
  client_id: string | null;
  owner_id: string | null;
  inbox_status: InboxStatus;
  task_id: string | null;
  sent_by: string | null;
  sent_at: string | null;
  read_at: string | null;
  received_at: string;
};

export type AppUser = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  role: string;
  google_refresh_token: string | null;
  google_access_token: string | null;
  google_access_token_expires_at: string | null;
  created_at: string;
};
