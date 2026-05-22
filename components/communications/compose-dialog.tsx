"use client";

import { useRef, useState } from "react";
import { Paperclip, Send, X } from "lucide-react";
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
  fileToAttachment,
  formatBytes,
  type StagedAttachment,
} from "@/lib/attachments";
import { useSendEmail } from "@/hooks/use-communications";

type ComposeDialogProps = { disabled?: boolean };

export function ComposeDialog({ disabled }: ComposeDialogProps) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<StagedAttachment[]>([]);
  const [staging, setStaging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const send = useSendEmail();

  const reset = () => {
    setTo("");
    setSubject("");
    setBody("");
    setAttachments([]);
  };

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

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const submit = async () => {
    const recipients = to
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .map((email) => ({ email }));
    if (recipients.length === 0 || !subject.trim() || !body.trim()) return;
    try {
      await send.mutateAsync({
        to: recipients,
        subject,
        body,
        attachments: attachments.map(({ filename, contentType, content, size }) => ({
          filename,
          contentType,
          content,
          size,
        })),
      });
      toast.success("Email sent");
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="brand" disabled={disabled}>
          <Send />
          Compose
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New email</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="comma-separated emails"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
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
                    onClick={() => removeAttachment(i)}
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
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="brand" onClick={submit} disabled={send.isPending}>
            {send.isPending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
