import createDOMPurify from "isomorphic-dompurify";

// Server-side sanitizer for inbound email HTML bodies.
//
// Email bodies are fully attacker-controlled (any third party can send mail),
// so the raw `text/html` part is the classic stored-XSS source. We sanitize it
// here — at the point the Gmail part is decoded — before it ever reaches the
// browser. This is the primary control; the rendering iframe (which also drops
// `allow-same-origin`) is defense-in-depth.
//
// Policy: allow the formatting and layout tags real emails rely on, plus inline
// styles and https/cid/data images, but strip <script>, event-handler
// attributes (onerror=, onload=, …), and javascript:/vbscript: URLs. DOMPurify
// removes those by default; FORBID_TAGS/ATTR make the intent explicit and also
// drop <form>/<iframe>/<object> which have no place in a rendered email.

const purify = createDOMPurify;

export function sanitizeEmailHtml(html: string): string {
  return purify.sanitize(html, {
    // Keep style/img so emails render; everything dangerous is dropped below.
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "base", "meta"],
    FORBID_ATTR: ["srcset", "ping", "formaction"],
    // Only allow safe URI schemes in href/src (blocks javascript:, vbscript:,
    // and bare data: in links while still permitting data:/cid: images).
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|tel|cid):|data:image\/(?:png|gif|jpe?g|webp|bmp);|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    // DOMPurify strips on*-handlers and unsafe URLs by default; ADD nothing
    // that would re-enable script execution.
    ADD_ATTR: ["target"],
  });
}
