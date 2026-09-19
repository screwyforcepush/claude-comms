export const ATTACHMENT_ROUTE_PREFIX = "/attachments/";
export const ATTACHMENT_AUTH_SCHEME = "Bearer";
export const ATTACHMENT_FETCH_COMMAND = "attachment-fetch";
export const ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;

const FETCH_CLI = "npx tsx .agents/tools/workflow/cli.ts";
const SUGGESTED_ATTACHMENT_DIR = "/tmp/attachments";
const MAX_SAFE_FILENAME_LENGTH = 120;
const UNSAFE_SUGGESTED_FILENAME_CHARS = /[^A-Za-z0-9._-]+/g;

export interface ChatAttachment {
  filename: string;
  storageId: string;
  size: number;
  mime: string;
}

export function formatBytes(bytes: number): string {
  const safeBytes = Number.isFinite(bytes) ? Math.max(0, bytes) : 0;
  if (safeBytes < 1024) return `${Math.round(safeBytes)} B`;

  const units = ["KB", "MB", "GB", "TB"];
  let value = safeBytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export function safeFilename(filename: string, maxLength = MAX_SAFE_FILENAME_LENGTH): string {
  const cleaned = filename
    .replace(/[\/\\]/g, "")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/\.{2,}/g, "-")
    .replace(UNSAFE_SUGGESTED_FILENAME_CHARS, "-")
    .trim()
    .replace(/^[.-]+/, "")
    .replace(/-+/g, "-")
    .replace(/^-+/, "");

  return truncateFilename(cleaned || "attachment", maxLength);
}

// @see docs/project/spec/mental-model.md — UI Mental Model / Message Attachments
export function renderAttachmentsBlock(
  content: string,
  attachments?: readonly ChatAttachment[]
): string {
  if (!attachments || attachments.length === 0) return content;

  const suggestedNames = uniqueSuggestedFilenames(attachments);
  const lines = [
    `**Attachments (${attachments.length})** — password-gated, not public. Fetch with the workflow toolkit, then Read the local file.`,
  ];

  attachments.forEach((attachment, index) => {
    const mime = attachment.mime || "application/octet-stream";
    const displayName = promptDisplayName(attachment.filename);
    lines.push(
      `${index + 1}. ${displayName} — ${mime}, ${formatBytes(attachment.size)} — storageId ${attachment.storageId}`
    );
    lines.push(
      `   ${FETCH_CLI} ${ATTACHMENT_FETCH_COMMAND} ${attachment.storageId} --out ${SUGGESTED_ATTACHMENT_DIR}/${suggestedNames[index]}`
    );
    if (attachment.size > ATTACHMENT_MAX_BYTES) {
      lines.push(
        "   ⚠ over 20 MB — the fetch route cannot serve this; ask the user for a smaller file"
      );
    }
  });

  const block = lines.join("\n");
  return content.length > 0 ? `${content}\n\n---\n${block}` : block;
}

export function parseAttachmentPath(pathname: string): string | null {
  if (!pathname.startsWith(ATTACHMENT_ROUTE_PREFIX)) return null;
  const encodedId = pathname.slice(ATTACHMENT_ROUTE_PREFIX.length);
  if (!encodedId || encodedId.includes("/")) return null;

  try {
    const storageId = decodeURIComponent(encodedId);
    if (!storageId || storageId.includes("/") || storageId.includes("\\")) return null;
    return storageId;
  } catch {
    return null;
  }
}

export function bearerFrom(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token ? token : null;
}

export function isAuthorized(bearer: string | null, expected: string | undefined): boolean {
  if (!bearer || !expected) return false;

  let difference = bearer.length ^ expected.length;
  const length = Math.max(bearer.length, expected.length);
  for (let i = 0; i < length; i++) {
    difference |= (bearer.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
  }
  return difference === 0;
}

export function contentDispositionFor(name: string): string {
  const cleanName = dispositionFilename(name);
  return `inline; filename="${asciiFallbackFilename(cleanName)}"; filename*=UTF-8''${encodeRfc5987(cleanName)}`;
}

export function attachmentResponseHeaders(args: {
  mime?: string;
  size: number;
  name: string;
}): Record<string, string> {
  return {
    "Content-Type": args.mime || "application/octet-stream",
    "Content-Length": String(args.size),
    "Content-Disposition": contentDispositionFor(args.name),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "Content-Disposition, Content-Length",
  };
}

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function uniqueSuggestedFilenames(attachments: readonly ChatAttachment[]): string[] {
  const used = new Set<string>();
  const counts = new Map<string, number>();

  return attachments.map((attachment) => {
    const baseName = safeFilename(attachment.filename);
    let count = (counts.get(baseName) ?? 0) + 1;
    let candidate = count === 1 ? baseName : withNumericSuffix(baseName, count);

    while (used.has(candidate)) {
      count++;
      candidate = withNumericSuffix(baseName, count);
    }

    counts.set(baseName, count);
    used.add(candidate);
    return candidate;
  });
}

function withNumericSuffix(filename: string, count: number): string {
  const suffix = `-${count}`;
  const { base, extension } = splitExtension(filename);
  const maxBaseLength = Math.max(1, MAX_SAFE_FILENAME_LENGTH - suffix.length - extension.length);
  return `${base.slice(0, maxBaseLength)}${suffix}${extension}`;
}

function truncateFilename(filename: string, maxLength: number): string {
  if (filename.length <= maxLength) return filename;

  const { base, extension } = splitExtension(filename);
  if (extension && extension.length < maxLength - 1) {
    return `${base.slice(0, maxLength - extension.length)}${extension}`;
  }
  return filename.slice(0, maxLength);
}

function splitExtension(filename: string): { base: string; extension: string } {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === filename.length - 1) {
    return { base: filename, extension: "" };
  }
  return {
    base: filename.slice(0, dotIndex),
    extension: filename.slice(dotIndex),
  };
}

function promptDisplayName(filename: string): string {
  const cleaned = filename.replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned || "attachment";
}

function dispositionFilename(name: string): string {
  const cleaned = name
    .replace(/[\/\\]/g, "")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/\.{2,}/g, ".")
    .trim()
    .replace(/^\.+/, "");
  return cleaned || "attachment";
}

function asciiFallbackFilename(name: string): string {
  const normalized = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  let fallback = "";

  for (const char of normalized) {
    const code = char.charCodeAt(0);
    fallback += code >= 0x20 && code <= 0x7e && char !== "\"" && char !== "\\"
      ? char
      : "_";
  }

  return fallback.trim() || "attachment";
}

function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(/['()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}
