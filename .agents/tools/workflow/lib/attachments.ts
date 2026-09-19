export const ATTACHMENT_ROUTE_PREFIX = "/attachments/";
export const ATTACHMENT_AUTH_SCHEME = "Bearer";
export const ATTACHMENT_FETCH_COMMAND = "attachment-fetch";
export const ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;

export interface AttachmentRequestInput {
  siteUrl: string;
  storageId: string;
  password: string;
}

export interface AttachmentRequest {
  url: string;
  headers: Record<string, string>;
}

export type AttachmentFetchFailure =
  | { type: "site-url"; convexUrl: string | null | undefined }
  | { type: "network"; siteUrl: string; error: unknown }
  | { type: "http"; status: number; storageId: string };

export interface AttachmentFetchSuccessInput {
  storageId: string;
  out: string;
  bytes: number;
  contentType: string;
}

export interface AttachmentFetchSuccess extends AttachmentFetchSuccessInput {
  ok: true;
}

export function deriveSiteUrl(convexUrl: string | null | undefined): string | null {
  const rawUrl = convexUrl?.trim();
  if (!rawUrl) return null;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.hostname.endsWith(".convex.cloud")) {
    url.hostname = url.hostname.replace(/\.convex\.cloud$/, ".convex.site");
  } else if (!url.hostname.endsWith(".convex.site")) {
    return null;
  }

  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.origin;
}

export function buildAttachmentRequest(input: AttachmentRequestInput): AttachmentRequest {
  const siteUrl = input.siteUrl.replace(/\/+$/, "");
  return {
    url: `${siteUrl}${ATTACHMENT_ROUTE_PREFIX}${encodeURIComponent(input.storageId)}`,
    headers: {
      Authorization: `${ATTACHMENT_AUTH_SCHEME} ${input.password}`,
    },
  };
}

export function describeFetchFailure(failure: AttachmentFetchFailure): string {
  switch (failure.type) {
    case "site-url":
      return `Cannot derive the HTTP-actions host from convexUrl "${failure.convexUrl ?? ""}"; set "convexSiteUrl" in config.json`;
    case "network":
      return `Cannot reach ${failure.siteUrl}: ${messageFromUnknown(failure.error)}`;
    case "http":
      if (failure.status === 401) {
        return "Unauthorized: config.json password does not match the deployment's ADMIN_PASSWORD";
      }
      if (failure.status === 404) {
        return `Attachment ${failure.storageId} not found — it was removed, or the storageId is wrong`;
      }
      if (failure.status === 413) {
        return "Attachment exceeds the 20 MB fetch limit; ask the user to re-share a smaller file";
      }
      return `Fetch failed with HTTP ${failure.status}`;
  }
}

export function successVerdict(input: AttachmentFetchSuccessInput): AttachmentFetchSuccess {
  return {
    ok: true,
    storageId: input.storageId,
    out: input.out,
    bytes: input.bytes,
    contentType: input.contentType,
  };
}

function messageFromUnknown(value: unknown): string {
  if (value instanceof Error) return value.message;
  return String(value);
}
