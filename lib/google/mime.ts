// Build a base64url-encoded RFC822 message for Gmail's users.messages.send.

export type Address = { email: string; name?: string };

export type MimeAttachment = {
  filename: string;
  contentType: string;
  content: string; // base64 (no data URL prefix)
};

export type MimeOptions = {
  from: Address;
  to: Address[];
  cc?: Address[];
  bcc?: Address[];
  subject: string;
  htmlBody: string;
  inReplyTo?: string;
  references?: string[];
  attachments?: MimeAttachment[];
};

function encodeHeaderWord(value: string) {
  // Use MIME encoded-word for any non-ASCII characters in display names.
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf-8").toString("base64")}?=`;
}

function formatAddress({ name, email }: Address) {
  if (!name) return email;
  return `${encodeHeaderWord(name)} <${email}>`;
}

function formatAddressList(addrs: Address[]) {
  return addrs.map(formatAddress).join(", ");
}

function base64url(input: string | Buffer) {
  const buf = typeof input === "string" ? Buffer.from(input, "utf-8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function chunk(s: string, size = 76) {
  const lines: string[] = [];
  for (let i = 0; i < s.length; i += size) lines.push(s.slice(i, i + size));
  return lines.join("\r\n");
}

export function buildMime(opts: MimeOptions): string {
  const boundary = `bnd_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  const hasAttachments = (opts.attachments?.length ?? 0) > 0;

  const headers: string[] = [
    `From: ${formatAddress(opts.from)}`,
    `To: ${formatAddressList(opts.to)}`,
  ];
  if (opts.cc && opts.cc.length > 0) headers.push(`Cc: ${formatAddressList(opts.cc)}`);
  if (opts.bcc && opts.bcc.length > 0)
    headers.push(`Bcc: ${formatAddressList(opts.bcc)}`);
  headers.push(`Subject: ${encodeHeaderWord(opts.subject)}`);
  headers.push("MIME-Version: 1.0");
  if (opts.inReplyTo) headers.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts.references && opts.references.length > 0)
    headers.push(`References: ${opts.references.join(" ")}`);

  if (!hasAttachments) {
    headers.push("Content-Type: text/html; charset=UTF-8");
    headers.push("Content-Transfer-Encoding: 7bit");
    return [headers.join("\r\n"), "", opts.htmlBody].join("\r\n");
  }

  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

  const parts: string[] = [
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    opts.htmlBody,
  ];

  for (const att of opts.attachments ?? []) {
    parts.push(
      `--${boundary}`,
      `Content-Type: ${att.contentType}; name="${att.filename.replace(/"/g, "")}"`,
      `Content-Disposition: attachment; filename="${att.filename.replace(/"/g, "")}"`,
      "Content-Transfer-Encoding: base64",
      "",
      chunk(att.content),
    );
  }
  parts.push(`--${boundary}--`);

  return [headers.join("\r\n"), "", parts.join("\r\n")].join("\r\n");
}

export function encodeMime(mime: string): string {
  return base64url(mime);
}
