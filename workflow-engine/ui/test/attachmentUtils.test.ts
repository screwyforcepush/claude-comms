/**
 * Tests for the buildless UI chat attachment helpers.
 *
 * Run with: npx tsx --test workflow-engine/ui/test/attachmentUtils.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  ATTACHMENT_AUTH_SCHEME,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_ROUTE_PREFIX,
  authHeaders,
  attachmentUrl,
  deriveSiteUrl,
  formatBytes,
  isImageMime,
  isOversize,
  parseDraftAttachments,
  serializeDraftAttachments,
} from "../js/components/chat/attachmentUtils.js";

describe("deriveSiteUrl", () => {
  it("derives Convex HTTP action hosts from cloud URLs", () => {
    assert.strictEqual(
      deriveSiteUrl("https://utmost-vulture-618.convex.cloud"),
      "https://utmost-vulture-618.convex.site"
    );
    assert.strictEqual(
      deriveSiteUrl("https://utmost-vulture-618.convex.cloud/"),
      "https://utmost-vulture-618.convex.site"
    );
  });

  it("passes through Convex site URLs and rejects unsupported origins", () => {
    assert.strictEqual(
      deriveSiteUrl("https://utmost-vulture-618.convex.site/"),
      "https://utmost-vulture-618.convex.site"
    );
    assert.strictEqual(deriveSiteUrl("http://localhost:3210"), null);
    assert.strictEqual(deriveSiteUrl(""), null);
    assert.strictEqual(deriveSiteUrl(null), null);
    assert.strictEqual(deriveSiteUrl("https://example.com"), null);
  });
});

describe("attachmentUrl", () => {
  it("builds the gated route with an encoded filename and no password", () => {
    const url = attachmentUrl(
      "https://utmost-vulture-618.convex.site/",
      "kg2abc123",
      "Q3 budget €.xlsx"
    );

    assert.strictEqual(
      url,
      "https://utmost-vulture-618.convex.site/attachments/kg2abc123?filename=Q3+budget+%E2%82%AC.xlsx"
    );
    assert.ok(!url.includes("top-secret"));
    assert.ok(!url.includes("password"));
  });

  it("omits the filename query when no filename is provided", () => {
    assert.strictEqual(
      attachmentUrl("https://utmost-vulture-618.convex.site", "kg2abc123"),
      "https://utmost-vulture-618.convex.site/attachments/kg2abc123"
    );
  });
});

describe("authHeaders", () => {
  it("puts the password only in the Authorization bearer header", () => {
    assert.deepStrictEqual(authHeaders("top-secret"), {
      Authorization: "Bearer top-secret",
    });
  });
});

describe("size and mime helpers", () => {
  it("treats exactly 20 MiB as allowed and +1 byte as oversize", () => {
    assert.strictEqual(isOversize(ATTACHMENT_MAX_BYTES), false);
    assert.strictEqual(isOversize(ATTACHMENT_MAX_BYTES + 1), true);
  });

  it("detects image MIME types only", () => {
    assert.strictEqual(isImageMime("image/png"), true);
    assert.strictEqual(isImageMime("image/svg+xml"), true);
    assert.strictEqual(isImageMime("IMAGE/JPEG"), true);
    assert.strictEqual(isImageMime("application/pdf"), false);
    assert.strictEqual(isImageMime(""), false);
    assert.strictEqual(isImageMime(null), false);
  });

  it("formats byte counts with the backend's binary-unit contract", () => {
    assert.strictEqual(formatBytes(0), "0 B");
    assert.strictEqual(formatBytes(1023), "1023 B");
    assert.strictEqual(formatBytes(1024), "1.0 KB");
    assert.strictEqual(formatBytes(188_621), "184.2 KB");
    assert.strictEqual(formatBytes(1_468_006), "1.4 MB");
    assert.strictEqual(formatBytes(ATTACHMENT_MAX_BYTES), "20.0 MB");
  });
});

describe("draft attachment persistence", () => {
  it("serializes only ready attachments and only the four persisted fields", () => {
    const serialized = serializeDraftAttachments([
      {
        id: "local-ready",
        filename: "screenshot.png",
        storageId: "kg2abc123",
        size: 188_621,
        mime: "image/png",
        status: "ready",
        oversize: false,
        extra: "not persisted",
      },
      {
        id: "local-uploading",
        filename: "uploading.png",
        storageId: null,
        size: 100,
        mime: "image/png",
        status: "uploading",
        oversize: false,
      },
      {
        id: "local-error",
        filename: "failed.png",
        storageId: null,
        size: 100,
        mime: "image/png",
        status: "error",
        oversize: false,
      },
    ]);

    assert.deepStrictEqual(JSON.parse(serialized), [
      {
        filename: "screenshot.png",
        storageId: "kg2abc123",
        size: 188_621,
        mime: "image/png",
      },
    ]);
  });

  it("parses malformed, missing, and non-array drafts as empty", () => {
    assert.deepStrictEqual(parseDraftAttachments(null), []);
    assert.deepStrictEqual(parseDraftAttachments(""), []);
    assert.deepStrictEqual(parseDraftAttachments("{not-json"), []);
    assert.deepStrictEqual(parseDraftAttachments('{"filename":"x"}'), []);
  });

  it("restores ready status and recomputes oversize", () => {
    const restored = parseDraftAttachments(JSON.stringify([
      {
        filename: "small.png",
        storageId: "kg2abc123",
        size: 188_621,
        mime: "image/png",
        ignored: true,
      },
      {
        filename: "huge.mov",
        storageId: "kg2def456",
        size: ATTACHMENT_MAX_BYTES + 1,
        mime: "",
      },
    ]));

    assert.strictEqual(restored.length, 2);
    assert.deepStrictEqual(restored[0], {
      id: "ready:kg2abc123",
      filename: "small.png",
      storageId: "kg2abc123",
      size: 188_621,
      mime: "image/png",
      status: "ready",
      oversize: false,
    });
    assert.deepStrictEqual(restored[1], {
      id: "ready:kg2def456",
      filename: "huge.mov",
      storageId: "kg2def456",
      size: ATTACHMENT_MAX_BYTES + 1,
      mime: "application/octet-stream",
      status: "ready",
      oversize: true,
    });
  });
});

describe("backend constant parity", () => {
  it("mirrors the Convex attachment contract when the backend module is present", async () => {
    const backendPath = resolve(process.cwd(), "workflow-engine/convex/lib/attachments.ts");
    if (!existsSync(backendPath)) return;

    const backend = await import(pathToFileURL(backendPath).href);

    assert.strictEqual(ATTACHMENT_ROUTE_PREFIX, backend.ATTACHMENT_ROUTE_PREFIX);
    assert.strictEqual(ATTACHMENT_AUTH_SCHEME, backend.ATTACHMENT_AUTH_SCHEME);
    assert.strictEqual(ATTACHMENT_MAX_BYTES, backend.ATTACHMENT_MAX_BYTES);
  });
});
