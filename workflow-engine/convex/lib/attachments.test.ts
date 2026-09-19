/**
 * Tests for the chat attachment backend contract.
 *
 * Run with: npx tsx --test workflow-engine/convex/lib/attachments.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_ROUTE_PREFIX,
  ATTACHMENT_AUTH_SCHEME,
  attachmentResponseHeaders,
  bearerFrom,
  contentDispositionFor,
  corsHeaders,
  formatBytes,
  isAuthorized,
  parseAttachmentPath,
  renderAttachmentsBlock,
  safeFilename,
} from "./attachments.js";

const storageA = "kg2abc123";
const storageB = "kg2def456";

describe("renderAttachmentsBlock", () => {
  it("returns content unchanged when no attachments are present", () => {
    assert.strictEqual(renderAttachmentsBlock("hello", undefined), "hello");
    assert.strictEqual(renderAttachmentsBlock("hello", []), "hello");
    assert.strictEqual(renderAttachmentsBlock("", []), "");
    assert.strictEqual(renderAttachmentsBlock("hello  \n", []), "hello  \n");
  });

  it("renders prose first, then one attachment with the toolkit command", () => {
    const rendered = renderAttachmentsBlock("Please inspect this.", [
      {
        filename: "screenshot.png",
        storageId: storageA,
        size: 188_621,
        mime: "image/png",
      },
    ]);

    assert.ok(rendered.startsWith("Please inspect this.\n\n---\n"));
    assert.ok(rendered.includes("**Attachments (1)**"));
    assert.ok(
      rendered.includes(
        "1. screenshot.png — image/png, 184.2 KB — storageId kg2abc123"
      )
    );
    assert.ok(
      rendered.includes(
        "   npx tsx .agents/tools/workflow/cli.ts attachment-fetch kg2abc123 --out /tmp/attachments/screenshot.png"
      )
    );
  });

  it("deduplicates suggested output filenames", () => {
    const rendered = renderAttachmentsBlock("Files:", [
      { filename: "report.pdf", storageId: storageA, size: 1024, mime: "application/pdf" },
      { filename: "report.pdf", storageId: storageB, size: 2048, mime: "application/pdf" },
    ]);

    assert.ok(rendered.includes("--out /tmp/attachments/report.pdf"));
    assert.ok(rendered.includes("--out /tmp/attachments/report-2.pdf"));
  });

  it("keeps the command for oversize attachments and adds the transport warning", () => {
    const rendered = renderAttachmentsBlock("Large file", [
      {
        filename: "big.mov",
        storageId: storageA,
        size: ATTACHMENT_MAX_BYTES + 1,
        mime: "video/quicktime",
      },
    ]);

    assert.ok(rendered.includes("--out /tmp/attachments/big.mov"));
    assert.ok(
      rendered.includes(
        "over 20 MB — the fetch route cannot serve this; ask the user for a smaller file"
      )
    );
  });

  it("renders only the block for empty prose", () => {
    const rendered = renderAttachmentsBlock("", [
      { filename: "notes.txt", storageId: storageA, size: 0, mime: "text/plain" },
    ]);

    assert.ok(rendered.startsWith("**Attachments (1)**"));
    assert.ok(!rendered.startsWith("\n"));
  });
});

describe("safeFilename", () => {
  it("strips separators and controls, collapses spaces, and falls back", () => {
    assert.strictEqual(safeFilename("dir/sub\\file\u0000 name.txt"), "dirsubfile-name.txt");
    assert.strictEqual(safeFilename("   "), "attachment");
    assert.strictEqual(safeFilename("\u0000/\\"), "attachment");
  });

  it("replaces shell metacharacters in suggested output filenames", () => {
    assert.strictEqual(safeFilename("invoice;touch-pwned.pdf"), "invoice-touch-pwned.pdf");
    assert.strictEqual(
      safeFilename("semi;and&dollar$back`pipe|in<out>quote'\"paren(name).txt"),
      "semi-and-dollar-back-pipe-in-out-quote-paren-name-.txt"
    );
  });

  it("returns only shell-safe filename characters after sanitation", () => {
    const safe = safeFilename("unsafe ;&$`|<>\"'()[]{}!*? name.pdf");

    assert.match(safe, /^[A-Za-z0-9._-]+$/);
  });

  it("hardens leading dots and dot-dot runs", () => {
    assert.strictEqual(safeFilename(".bashrc"), "bashrc");
    assert.strictEqual(safeFilename("..env"), "env");
    assert.strictEqual(safeFilename("report..final.pdf"), "report-final.pdf");
  });

  it("preserves extensions when truncating to 120 characters", () => {
    const filename = `${"a".repeat(160)}.spreadsheet`;
    const safe = safeFilename(filename);

    assert.strictEqual(safe.length, 120);
    assert.ok(safe.endsWith(".spreadsheet"));
  });

  it("renders shell-safe suggested names in unquoted attachment commands", () => {
    const rendered = renderAttachmentsBlock("Please inspect this.", [
      {
        filename: "invoice;touch-pwned && $(echo bad).pdf",
        storageId: storageA,
        size: 1024,
        mime: "application/pdf",
      },
    ]);
    const commandLine = rendered
      .split("\n")
      .find((line) => line.includes("attachment-fetch"));

    assert.ok(commandLine);
    const suggestedPath = commandLine.slice(commandLine.lastIndexOf("/") + 1);
    assert.match(suggestedPath, /^[A-Za-z0-9._-]+$/);
    assert.ok(commandLine.includes("--out /tmp/attachments/invoice-touch-pwned-echo-bad-.pdf"));
  });
});

describe("formatBytes", () => {
  it("formats byte counts using binary units", () => {
    assert.strictEqual(formatBytes(0), "0 B");
    assert.strictEqual(formatBytes(1023), "1023 B");
    assert.strictEqual(formatBytes(1024), "1.0 KB");
    assert.strictEqual(formatBytes(188_621), "184.2 KB");
    assert.strictEqual(formatBytes(1_468_006), "1.4 MB");
    assert.strictEqual(formatBytes(ATTACHMENT_MAX_BYTES), "20.0 MB");
  });
});

describe("route and auth helpers", () => {
  it("parses exactly one storage id segment from the attachment route", () => {
    assert.strictEqual(parseAttachmentPath("/attachments/kg2abc"), "kg2abc");
    assert.strictEqual(parseAttachmentPath("/attachments/"), null);
    assert.strictEqual(parseAttachmentPath("/attachments/kg2abc/extra"), null);
    assert.strictEqual(parseAttachmentPath("/other/kg2abc"), null);
  });

  it("parses bearer tokens from authorization headers", () => {
    assert.strictEqual(bearerFrom("Bearer secret"), "secret");
    assert.strictEqual(bearerFrom("bearer secret"), "secret");
    assert.strictEqual(bearerFrom("Bearer   spaced"), "spaced");
    assert.strictEqual(bearerFrom(null), null);
    assert.strictEqual(bearerFrom(""), null);
    assert.strictEqual(bearerFrom("Basic secret"), null);
    assert.strictEqual(bearerFrom("Bearer   "), null);
  });

  it("authorizes only matching bearer tokens with configured expected value", () => {
    assert.strictEqual(isAuthorized("secret", "secret"), true);
    assert.strictEqual(isAuthorized("secret", "other"), false);
    assert.strictEqual(isAuthorized(null, "secret"), false);
    assert.strictEqual(isAuthorized("secret", undefined), false);
    assert.strictEqual(isAuthorized("", "secret"), false);
  });
});

describe("response headers", () => {
  it("emits dual content-disposition filename parameters", () => {
    const disposition = contentDispositionFor("Q3 budget €.xlsx");

    assert.ok(disposition.startsWith('inline; filename="'));
    assert.ok(disposition.includes('filename="Q3 budget _.xlsx"'));
    assert.ok(
      disposition.includes("filename*=UTF-8''Q3%20budget%20%E2%82%AC.xlsx")
    );
  });

  it("builds attachment response headers with privacy and CORS controls", () => {
    const headers = attachmentResponseHeaders({
      mime: "",
      size: 42,
      name: "Q3 budget €.xlsx",
    });

    assert.strictEqual(headers["Content-Type"], "application/octet-stream");
    assert.strictEqual(headers["Content-Length"], "42");
    assert.strictEqual(headers["Cache-Control"], "private, no-store");
    assert.strictEqual(headers["X-Content-Type-Options"], "nosniff");
    assert.strictEqual(headers["Access-Control-Allow-Origin"], "*");
    assert.strictEqual(
      headers["Access-Control-Expose-Headers"],
      "Content-Disposition, Content-Length"
    );
    assert.ok(headers["Content-Disposition"].includes("filename*="));
  });

  it("builds preflight CORS headers", () => {
    assert.deepStrictEqual(corsHeaders(), {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization",
      "Access-Control-Max-Age": "86400",
    });
  });
});

describe("contract constants", () => {
  it("pins the route, auth scheme, and transport max", () => {
    assert.strictEqual(ATTACHMENT_ROUTE_PREFIX, "/attachments/");
    assert.strictEqual(ATTACHMENT_AUTH_SCHEME, "Bearer");
    assert.strictEqual(ATTACHMENT_MAX_BYTES, 20 * 1024 * 1024);
  });
});
