"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  EyeOff,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ComposeDialog } from "@/components/communications/compose-dialog";
import {
  useAttachThread,
  useCommunications,
  useCreateTaskFromThread,
  useDisconnectGmail,
  useIgnoreThread,
  useMarkThreadRead,
  useSendEmail,
  useThread,
  type GmailMessage,
  type GmailThread,
} from "@/hooks/use-communications";
import { useTasks } from "@/hooks/use-tasks";
import {
  fileToAttachment,
  formatBytes,
  type StagedAttachment,
} from "@/lib/attachments";
import { cn } from "@/lib/utils";

type Tab = "inbox" | "attached" | "ignored";

const RESIZE_MESSAGE_TYPE = "ms4-mail-resize";

function formatThreadTime(date: number | string | undefined) {
  if (date == null) return "";
  const d =
    typeof date === "number" ? new Date(date * 1000) : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatMessageDate(epochSeconds: number) {
  const d = new Date(epochSeconds * 1000);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function dateGroup(date: number | string | undefined): string {
  if (date == null) return "EARLIER";
  const d =
    typeof date === "number" ? new Date(date * 1000) : new Date(date);
  if (Number.isNaN(d.getTime())) return "EARLIER";
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yest = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  const weekStart = new Date(start.getTime() - 6 * 24 * 60 * 60 * 1000);
  if (d >= start) return "TODAY";
  if (d >= yest) return "YESTERDAY";
  if (d >= weekStart) return "EARLIER THIS WEEK";
  return d
    .toLocaleDateString("en-US", { month: "long", year: "numeric" })
    .toUpperCase();
}

function TabPill({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number | string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-full px-4 py-1.5 text-theme-sm font-medium transition-colors",
        active
          ? "bg-gray-900 text-white"
          : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800",
      )}
    >
      {label}
      {count != null && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
            active
              ? "bg-brand-500 text-white"
              : "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function ThreadRow({
  thread,
  selected,
  onSelectChange,
  onOpen,
  onAttach,
  onIgnore,
  onNewTask,
  isOpen,
  pending,
}: {
  thread: GmailThread;
  selected: boolean;
  onSelectChange: (next: boolean) => void;
  onOpen: () => void;
  onAttach: () => void;
  onIgnore: () => void;
  onNewTask: () => void;
  isOpen: boolean;
  pending: boolean;
}) {
  const sender = thread.participants?.[0];
  const senderName = sender?.name || sender?.email || "(no sender)";
  const time = formatThreadTime(thread.latestDraftOrMessageDate);

  return (
    <div
      className={cn(
        "group relative flex gap-3 border-b border-gray-200 px-4 py-3 transition-colors dark:border-gray-800",
        isOpen
          ? "bg-brand-50/60 dark:bg-brand-900/20"
          : "hover:bg-gray-50 dark:hover:bg-gray-800/40",
      )}
    >
      <div className="pt-1">
        <Checkbox
          checked={selected}
          onCheckedChange={(v) => onSelectChange(v === true)}
        />
      </div>
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          {thread.unread && (
            <span className="size-2 shrink-0 rounded-full bg-brand-500" />
          )}
          <span
            className={cn(
              "truncate text-theme-sm",
              thread.unread
                ? "font-semibold text-gray-900 dark:text-white"
                : "font-medium text-gray-700 dark:text-gray-300",
            )}
          >
            {senderName}
          </span>
          <span className="ml-auto shrink-0 text-theme-xs text-gray-500">
            {time}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-theme-xs text-gray-500">
          <Mail className="size-3" />
          <span className="truncate">{thread.subject || "(no subject)"}</span>
        </div>
        <div className="mt-1 line-clamp-2 text-theme-xs text-gray-500 dark:text-gray-400">
          {thread.snippet}
        </div>
        <div className="mt-2 flex items-center gap-3 text-theme-xs text-gray-500">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNewTask();
            }}
            className="inline-flex items-center gap-1 hover:text-gray-900 disabled:opacity-50 dark:hover:text-white"
            disabled={pending}
          >
            <Plus className="size-3.5" />
            New Task
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAttach();
            }}
            className="inline-flex items-center gap-1 hover:text-gray-900 disabled:opacity-50 dark:hover:text-white"
            disabled={pending}
          >
            <Link2 className="size-3.5" />
            Attach
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onIgnore();
            }}
            className="inline-flex items-center gap-1 hover:text-gray-900 disabled:opacity-50 dark:hover:text-white"
            disabled={pending}
          >
            <EyeOff className="size-3.5" />
            Ignore
          </button>
          {pending && <Loader2 className="size-3.5 animate-spin text-gray-400" />}
        </div>
      </button>
    </div>
  );
}

function MessageBody({
  html,
  text,
  iframeKey,
}: {
  html: string | null;
  text?: string | null;
  iframeKey: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState<number>(240);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || data.type !== RESIZE_MESSAGE_TYPE) return;
      if (data.key !== iframeKey) return;
      if (typeof data.height !== "number") return;
      const cap = Math.max(240, window.innerHeight - 200);
      setHeight(Math.min(Math.max(data.height + 8, 120), cap));
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [iframeKey]);

  if (html) {
    const escapedKey = JSON.stringify(iframeKey);
    const script = `
      var key=${escapedKey};
      function postHeight(){
        try { parent.postMessage({type:"${RESIZE_MESSAGE_TYPE}",key:key,height:document.body.scrollHeight},"*"); } catch(e){}
      }
      window.addEventListener("load", postHeight);
      if (typeof ResizeObserver !== "undefined") {
        new ResizeObserver(postHeight).observe(document.body);
      } else {
        setTimeout(postHeight, 100);
        setTimeout(postHeight, 500);
      }
    `;
    // The email HTML is already sanitized server-side (lib/sanitize-html.ts).
    // The CSP below is defense-in-depth: it permits inline styles and remote
    // images (which emails need) but blocks any object/embed/frame and external
    // script sources. The only script that runs is our own resize helper.
    const csp =
      "default-src 'none'; img-src https: data: cid:; style-src 'unsafe-inline'; " +
      "font-src https: data:; script-src 'unsafe-inline'";
    const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank"><style>html,body{margin:0;padding:12px;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#111;background:transparent}img{max-width:100%;height:auto}a{color:#2563eb}</style></head><body>${html}<script>${script}<\/script></body></html>`;
    return (
      <iframe
        ref={iframeRef}
        // No allow-same-origin: the frame runs in a null/opaque origin so even
        // if sanitization were bypassed, script could not reach this app's
        // origin (cookies, session, /api). The resize script posts to "*" and
        // the parent validates the message type+key, so same-origin is not
        // needed.
        sandbox="allow-popups allow-scripts"
        srcDoc={srcDoc}
        style={{ height: `${height}px` }}
        className="block w-full border-0 bg-white dark:bg-gray-950"
      />
    );
  }
  return (
    <div className="text-theme-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300">
      {text ?? "(no content)"}
    </div>
  );
}

function MessageItem({ msg }: { msg: GmailMessage }) {
  const fromPerson = msg.from?.[0];
  const fromLabel = fromPerson
    ? fromPerson.name
      ? `${fromPerson.name} <${fromPerson.email}>`
      : fromPerson.email
    : "(unknown sender)";
  const toLabel = (msg.to ?? [])
    .map((p) => p.name || p.email)
    .filter(Boolean)
    .join(", ");

  return (
    <div className="border-b border-gray-200 px-5 py-4 last:border-b-0 dark:border-gray-800">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-theme-sm font-semibold text-gray-900 dark:text-white">
          {fromLabel}
        </div>
        <div className="text-theme-xs text-gray-500">
          {formatMessageDate(msg.date)}
        </div>
      </div>
      {toLabel && (
        <div className="mb-3 text-theme-xs text-gray-500">to {toLabel}</div>
      )}
      <MessageBody html={msg.body} text={msg.snippet} iframeKey={msg.id} />
    </div>
  );
}

function ReplyComposer({
  thread,
  messages,
}: {
  thread: GmailThread | null;
  messages: GmailMessage[];
}) {
  const lastInbound = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.from && m.from.length > 0) return m;
    }
    return messages[messages.length - 1];
  }, [messages]);

  const defaultTo = useMemo(() => {
    if (!lastInbound) return "";
    return (lastInbound.from ?? []).map((p) => p.email).join(", ");
  }, [lastInbound]);

  const [to, setTo] = useState(defaultTo);
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<StagedAttachment[]>([]);
  const [staging, setStaging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const send = useSendEmail();

  useEffect(() => {
    setTo(defaultTo);
    setBody("");
    setAttachments([]);
  }, [defaultTo, thread?.id]);

  if (!thread || !lastInbound) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800">
          <MessageCircle className="size-5" />
        </div>
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          Empty conversation
        </p>
      </div>
    );
  }

  const subject = thread.subject
    ? thread.subject.toLowerCase().startsWith("re:")
      ? thread.subject
      : `Re: ${thread.subject}`
    : "Re: (no subject)";

  const onFilesPicked = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setStaging(true);
    try {
      const next = await Promise.all(Array.from(files).map(fileToAttachment));
      setAttachments((prev) => [...prev, ...next]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to read file");
    } finally {
      setStaging(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async () => {
    const recipients = to
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((email) => ({ email }));
    if (recipients.length === 0 || !body.trim()) {
      toast.error("Add a recipient and a message");
      return;
    }
    try {
      await send.mutateAsync({
        to: recipients,
        subject,
        body,
        reply_to_message_id: lastInbound.id,
        attachments: attachments.map(({ filename, contentType, content, size }) => ({
          filename,
          contentType,
          content,
          size,
        })),
      });
      toast.success("Reply sent");
      setBody("");
      setAttachments([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <div className="text-theme-xs font-semibold tracking-wide text-gray-500 uppercase">
          Reply
        </div>
        <div className="mt-1 truncate text-theme-sm font-medium text-gray-900 dark:text-white">
          {subject}
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        <div className="space-y-1.5">
          <Label htmlFor="reply-to">To</Label>
          <Input
            id="reply-to"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="comma-separated emails"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reply-body">Message</Label>
          <Textarea
            id="reply-body"
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type your reply…"
          />
        </div>
        {attachments.length > 0 && (
          <ul className="space-y-1">
            {attachments.map((a, i) => (
              <li
                key={`${a.filename}-${i}`}
                className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-theme-xs dark:border-gray-800 dark:bg-gray-900"
              >
                <span className="truncate">
                  {a.filename}{" "}
                  <span className="text-gray-500">({formatBytes(a.size)})</span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setAttachments((prev) => prev.filter((_, j) => j !== i))
                  }
                  className="ml-2 text-gray-500 hover:text-gray-900"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => onFilesPicked(e.target.files)}
          />
          <Button
            variant="outline"
            size="sm"
            type="button"
            disabled={staging}
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="size-4" />
            {staging ? "Reading…" : "Attach files"}
          </Button>
        </div>
      </div>
      <div className="border-t border-gray-200 px-4 py-3 dark:border-gray-800">
        <Button
          variant="brand"
          className="w-full"
          onClick={submit}
          disabled={send.isPending}
        >
          <Send className="size-4" />
          {send.isPending ? "Sending…" : "Send reply"}
        </Button>
      </div>
    </div>
  );
}

function ThreadDetail({
  thread,
  messages,
  isLoading,
  error,
}: {
  thread: GmailThread | undefined;
  messages: GmailMessage[];
  isLoading: boolean;
  error: unknown;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3 p-5">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <p className="text-theme-sm text-error-600">
          Couldn&rsquo;t load this thread.
        </p>
      </div>
    );
  }

  const participants = thread?.participants ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 px-5 py-3 dark:border-gray-800">
        <div className="text-base font-semibold text-gray-900 dark:text-white">
          {thread?.subject || "(no subject)"}
        </div>
        <div className="mt-1 text-theme-xs text-gray-500">
          {participants.map((p) => p.name || p.email).join(", ")}
        </div>
      </div>
      <div className="custom-scrollbar flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <p className="text-theme-sm text-gray-500">No messages in this thread.</p>
          </div>
        ) : (
          messages.map((m) => <MessageItem key={m.id} msg={m} />)
        )}
      </div>
    </div>
  );
}

// Official Google "G" mark (4-color, unmodified) per Google's sign-in branding
// guidelines. Do not recolor or distort.
function GoogleGlyph() {
  return (
    <svg viewBox="0 0 18 18" className="size-[18px] shrink-0" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A9 9 0 0 0 0 9c0 1.452.348 2.827.957 4.04l3.007-2.333Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A9 9 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}

function ConnectGmailEmptyState() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-900/30">
        <Mail className="size-6" />
      </div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        Connect your Gmail
      </h2>
      <p className="mt-2 text-theme-sm text-gray-600 dark:text-gray-400">
        Grant MySigrid access to your Gmail to read, reply to, and send email
        here. You can disconnect at any time.
      </p>
      {/* Google-branded sign-in button (white variant, Roboto, official G mark). */}
      <a
        href="/api/communications/google/connect"
        className="mt-6 inline-flex h-10 items-center gap-3 rounded border border-[#747775] bg-white px-3 text-[14px] font-medium text-[#1f1f1f] shadow-sm transition hover:bg-[#f7f8f8] hover:shadow"
        style={{
          fontFamily:
            "Roboto, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <GoogleGlyph />
        Sign in with Google
      </a>
      <p className="mt-4 text-theme-xs text-gray-500 dark:text-gray-400">
        MySigrid&rsquo;s use of your Google data follows the{" "}
        <a
          href="https://www.mysigrid.com/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gray-700 dark:hover:text-gray-200"
        >
          Privacy Policy
        </a>
        , including the Google API Services User Data Policy (Limited Use).
      </p>
    </div>
  );
}

function AttachToTaskDialog({
  threadId,
  open,
  onOpenChange,
}: {
  threadId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: tasks, isLoading } = useTasks({ status: "active" });
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const attach = useAttachThread();

  useEffect(() => {
    if (open) setSelectedTaskId("");
  }, [open]);

  const submit = async () => {
    if (!threadId || !selectedTaskId) return;
    try {
      await attach.mutateAsync({ threadId, task_id: selectedTaskId });
      toast.success("Email attached to task");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to attach");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Attach to task</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Task</Label>
          {isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (tasks ?? []).length === 0 ? (
            <p className="text-theme-sm text-gray-500">
              No active tasks yet. Use &ldquo;New Task&rdquo; from the thread row
              to create one from the email instead.
            </p>
          ) : (
            <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an active task" />
              </SelectTrigger>
              <SelectContent>
                {(tasks ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!selectedTaskId || attach.isPending}
          >
            {attach.isPending ? "Attaching…" : "Attach"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CommunicationsContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const gmailResult = sp.get("gmail");
  const [tab, setTab] = useState<Tab>("inbox");
  const { data, isLoading, refetch, isFetching } = useCommunications(tab);

  // Surface the outcome of the "Connect Gmail" OAuth round-trip, then strip the
  // query param so it doesn't re-fire on refresh.
  useEffect(() => {
    if (gmailResult === "connected") toast.success("Gmail connected");
    else if (gmailResult === "error") toast.error("Couldn't connect Gmail. Try again.");
    if (gmailResult) router.replace("/communications");
  }, [gmailResult, router]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [attachDialogFor, setAttachDialogFor] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const markRead = useMarkThreadRead();
  const ignore = useIgnoreThread();
  const newTask = useCreateTaskFromThread();
  const disconnect = useDisconnectGmail();

  const sourceItems = useMemo<GmailThread[]>(() => data?.items ?? [], [data?.items]);
  const connected = data?.connected === true;

  const threads = useMemo(() => {
    if (!search.trim()) return sourceItems;
    const q = search.toLowerCase();
    return sourceItems.filter(
      (t) =>
        (t.subject ?? "").toLowerCase().includes(q) ||
        (t.snippet ?? "").toLowerCase().includes(q) ||
        t.participants?.some(
          (p) =>
            (p.name ?? "").toLowerCase().includes(q) ||
            p.email.toLowerCase().includes(q),
        ),
    );
  }, [sourceItems, search]);

  const grouped = useMemo(() => {
    const groups = new Map<string, GmailThread[]>();
    for (const t of threads) {
      const g = dateGroup(t.latestDraftOrMessageDate);
      const arr = groups.get(g) ?? [];
      arr.push(t);
      groups.set(g, arr);
    }
    return Array.from(groups.entries());
  }, [threads]);

  const inboxCount = sourceItems.length;
  const allSelected =
    threads.length > 0 && threads.every((t) => selectedIds.has(t.id));

  const toggleAll = (next: boolean) => {
    setSelectedIds(next ? new Set(threads.map((t) => t.id)) : new Set());
  };
  const toggleOne = (id: string, next: boolean) => {
    setSelectedIds((prev) => {
      const out = new Set(prev);
      if (next) out.add(id);
      else out.delete(id);
      return out;
    });
  };

  const openThread = (id: string) => {
    setOpenId(id);
    if (!connected) return;
    const thread = sourceItems.find((t) => t.id === id);
    if (thread?.unread) {
      markRead.mutate({ threadId: id, unread: false });
    }
  };

  const onIgnore = async (threadId: string) => {
    setPendingActionId(threadId);
    try {
      await ignore.mutateAsync(threadId);
      toast.success("Moved to Ignored");
      if (openId === threadId) setOpenId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to ignore");
    } finally {
      setPendingActionId(null);
    }
  };

  const onNewTask = async (threadId: string) => {
    setPendingActionId(threadId);
    try {
      const { task } = await newTask.mutateAsync({ threadId });
      toast.success(`Task created: ${task.title}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setPendingActionId(null);
    }
  };

  const onDisconnect = async () => {
    if (!window.confirm("Disconnect this Gmail account?")) return;
    try {
      await disconnect.mutateAsync();
      toast.success("Gmail disconnected");
      setOpenId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disconnect");
    }
  };

  const threadQuery = useThread(connected ? openId : null);
  const detailMessages = threadQuery.data?.messages ?? [];
  const detailThreadMeta =
    threadQuery.data?.thread ??
    (openId ? sourceItems.find((t) => t.id === openId) : undefined);

  if (isLoading) {
    return <Skeleton className="h-[60vh] w-full" />;
  }

  // Signed in but Gmail not connected (or revoked): prompt to connect.
  if (!connected) {
    return (
      <div className="space-y-4">
        <ConnectGmailEmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onDisconnect}
          disabled={disconnect.isPending}
        >
          {disconnect.isPending ? "Disconnecting…" : "Disconnect Gmail"}
        </Button>
        <ComposeDialog />
      </div>

      <div className="grid h-[calc(100vh-12rem)] grid-cols-1 gap-3 lg:grid-cols-[380px_minmax(0,1fr)_340px]">
        {/* LEFT: inbox list */}
        <Card className="flex h-full flex-col overflow-hidden p-0">
          <div className="flex items-center gap-2 px-3 pt-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                className="h-9 pl-9 text-theme-sm"
              />
            </div>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-200 px-3 text-theme-sm dark:border-gray-800"
            >
              <Mail className="size-4" />
              1 Email
              <ChevronDown className="size-3.5 text-gray-400" />
            </button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              aria-label="Refresh"
              className="h-9 w-9"
            >
              <RefreshCw
                className={cn("size-4", isFetching && "animate-spin")}
              />
            </Button>
          </div>

          <div className="flex items-center gap-1.5 border-b border-gray-200 px-3 py-3 dark:border-gray-800">
            <TabPill
              active={tab === "inbox"}
              onClick={() => setTab("inbox")}
              label="Inbox"
              count={tab === "inbox" ? (inboxCount > 99 ? "99+" : inboxCount) : undefined}
            />
            <TabPill
              active={tab === "attached"}
              onClick={() => setTab("attached")}
              label="Attached"
            />
            <TabPill
              active={tab === "ignored"}
              onClick={() => setTab("ignored")}
              label="Ignored"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 border-b border-gray-200 px-4 py-2.5 text-theme-sm text-gray-600 dark:border-gray-800 dark:text-gray-300">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(v) => toggleAll(v === true)}
            />
            Select All
          </label>

          <div className="custom-scrollbar flex-1 overflow-y-auto">
            {grouped.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-16 text-center">
                <Mail className="mb-2 size-6 text-gray-300" />
                <p className="text-theme-sm text-gray-500">
                  {tab === "inbox"
                    ? "Your inbox is empty."
                    : tab === "attached"
                      ? "No emails attached to a task yet."
                      : "Nothing ignored."}
                </p>
              </div>
            ) : (
              grouped.map(([group, items]) => (
                <div key={group}>
                  <div className="bg-gray-50 px-4 py-1.5 text-[10px] font-semibold tracking-[0.12em] text-gray-500 uppercase dark:bg-gray-900/50">
                    {group}
                  </div>
                  {items.map((t) => (
                    <ThreadRow
                      key={t.id}
                      thread={t}
                      selected={selectedIds.has(t.id)}
                      onSelectChange={(v) => toggleOne(t.id, v)}
                      onOpen={() => openThread(t.id)}
                      onAttach={() => setAttachDialogFor(t.id)}
                      onIgnore={() => onIgnore(t.id)}
                      onNewTask={() => onNewTask(t.id)}
                      isOpen={openId === t.id}
                      pending={pendingActionId === t.id}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        </Card>

        {/* CENTER: thread detail */}
        <Card className="flex h-full flex-col overflow-hidden p-0">
          {openId ? (
            <ThreadDetail
              thread={detailThreadMeta as GmailThread | undefined}
              messages={detailMessages}
              isLoading={threadQuery.isLoading}
              error={threadQuery.error}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800">
                <Mail className="size-5" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                No Message Selected
              </h3>
              <p className="mt-1 max-w-xs text-theme-sm text-gray-500 dark:text-gray-400">
                Select a message from your inbox to view it here
              </p>
            </div>
          )}
        </Card>

        {/* RIGHT: reply composer */}
        <Card className="hidden h-full flex-col overflow-hidden p-0 lg:flex">
          {openId && detailThreadMeta ? (
            <ReplyComposer
              thread={detailThreadMeta as GmailThread}
              messages={detailMessages}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800">
                <MessageCircle className="size-5" />
              </div>
              <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                Open a thread to reply
              </p>
            </div>
          )}
        </Card>
      </div>

      <AttachToTaskDialog
        threadId={attachDialogFor}
        open={!!attachDialogFor}
        onOpenChange={(o) => !o && setAttachDialogFor(null)}
      />
    </div>
  );
}

export default function CommunicationsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <CommunicationsContent />
    </Suspense>
  );
}
