import { httpRouter } from "convex/server";
import { Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_ROUTE_PREFIX,
  attachmentResponseHeaders,
  bearerFrom,
  corsHeaders,
  isAuthorized,
  parseAttachmentPath,
} from "./lib/attachments";

const http = httpRouter();

// @see docs/project/spec/mental-model.md — UI Mental Model / Message Attachments
const getAttachment = httpAction(async (ctx, request) => {
  try {
    const url = new URL(request.url);
    const storageId = parseAttachmentPath(url.pathname);
    if (!storageId) {
      return textResponse("Bad attachment path", 400);
    }

    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) {
      return textResponse("Server misconfigured", 500);
    }

    const bearer = bearerFrom(request.headers.get("Authorization"));
    if (!isAuthorized(bearer, expected)) {
      return textResponse("Unauthorized", 401);
    }

    let blob: Blob | null;
    try {
      blob = await ctx.storage.get(storageId as Id<"_storage">);
    } catch {
      return textResponse("Attachment not found", 404);
    }

    if (!blob) {
      return textResponse("Attachment not found", 404);
    }

    if (blob.size > ATTACHMENT_MAX_BYTES) {
      return textResponse("Attachment exceeds the 20 MB fetch limit", 413);
    }

    return new Response(blob, {
      status: 200,
      headers: attachmentResponseHeaders({
        mime: blob.type,
        size: blob.size,
        name: url.searchParams.get("filename") || storageId,
      }),
    });
  } catch {
    const expected = process.env.ADMIN_PASSWORD;
    return textResponse(expected ? "Unauthorized" : "Server misconfigured", expected ? 401 : 500);
  }
});

const optionsAttachment = httpAction(async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
});

http.route({
  pathPrefix: ATTACHMENT_ROUTE_PREFIX,
  method: "GET",
  handler: getAttachment,
});

http.route({
  pathPrefix: ATTACHMENT_ROUTE_PREFIX,
  method: "OPTIONS",
  handler: optionsAttachment,
});

export default http;

function textResponse(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
