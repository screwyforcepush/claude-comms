export const ATTACHMENT_ROUTE_PREFIX = "/attachments/";
export const ATTACHMENT_AUTH_SCHEME = "Bearer";
export const ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;
export const DEFAULT_ATTACHMENT_MIME = "application/octet-stream";

export function deriveSiteUrl(convexUrl) {
  if (!convexUrl) return null;

  try {
    const url = new URL(convexUrl);
    if (url.protocol !== "https:") return null;

    if (url.hostname.endsWith(".convex.site")) {
      return `${url.protocol}//${url.hostname}`;
    }

    if (url.hostname.endsWith(".convex.cloud")) {
      const slug = url.hostname.slice(0, -".convex.cloud".length);
      if (!slug) return null;
      return `${url.protocol}//${slug}.convex.site`;
    }
  } catch {
    return null;
  }

  return null;
}

export function attachmentUrl(siteUrl, storageId, filename) {
  const base = stripTrailingSlash(siteUrl);
  const url = new URL(`${base}${ATTACHMENT_ROUTE_PREFIX}${encodeURIComponent(storageId)}`);
  if (filename) {
    url.searchParams.set("filename", filename);
  }
  return url.toString();
}

export function authHeaders(password) {
  return {
    Authorization: `${ATTACHMENT_AUTH_SCHEME} ${password}`,
  };
}

export function isOversize(size) {
  return Number(size) > ATTACHMENT_MAX_BYTES;
}

export function isImageMime(mime) {
  return typeof mime === "string" && mime.toLowerCase().startsWith("image/");
}

export function formatBytes(bytes) {
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

export function serializeDraftAttachments(attachments) {
  const ready = Array.isArray(attachments) ? attachments : [];
  return JSON.stringify(ready
    .filter((attachment) => attachment?.status === "ready" && attachment.storageId)
    .map((attachment) => ({
      filename: stringOrFallback(attachment.filename, "attachment"),
      storageId: String(attachment.storageId),
      size: numberOrZero(attachment.size),
      mime: stringOrFallback(attachment.mime, DEFAULT_ATTACHMENT_MIME),
    })));
}

export function parseDraftAttachments(serialized) {
  if (!serialized) return [];

  try {
    const parsed = JSON.parse(serialized);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((attachment) => {
      if (!attachment || typeof attachment !== "object") return [];
      if (!attachment.filename || !attachment.storageId) return [];

      const size = numberOrZero(attachment.size);
      const mime = stringOrFallback(attachment.mime, DEFAULT_ATTACHMENT_MIME);
      const storageId = String(attachment.storageId);

      return [{
        id: `ready:${storageId}`,
        filename: String(attachment.filename),
        storageId,
        size,
        mime,
        status: "ready",
        oversize: isOversize(size),
      }];
    });
  } catch {
    return [];
  }
}

export async function fetchAttachmentBlob({
  siteUrl,
  storageId,
  filename,
  password,
  signal,
}) {
  const response = await fetch(attachmentUrl(siteUrl, storageId, filename), {
    method: "GET",
    headers: authHeaders(password),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Attachment fetch failed with HTTP ${response.status}`);
  }

  return await response.blob();
}

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function stringOrFallback(value, fallback) {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function numberOrZero(value) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}
