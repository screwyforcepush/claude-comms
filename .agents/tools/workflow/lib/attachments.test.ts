/**
 * Tests for the workflow toolkit chat attachment helpers.
 *
 * Run with: npx tsx --test .agents/tools/workflow/lib/attachments.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  ATTACHMENT_AUTH_SCHEME,
  ATTACHMENT_FETCH_COMMAND,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_ROUTE_PREFIX,
  buildAttachmentRequest,
  deriveSiteUrl,
  describeFetchFailure,
  successVerdict,
} from "./attachments.js";

describe("deriveSiteUrl", () => {
  it("derives the HTTP-actions host from Convex cloud URLs", () => {
    assert.strictEqual(
      deriveSiteUrl("https://utmost-vulture-618.convex.cloud"),
      "https://utmost-vulture-618.convex.site"
    );
    assert.strictEqual(
      deriveSiteUrl("https://utmost-vulture-618.convex.cloud/"),
      "https://utmost-vulture-618.convex.site"
    );
  });

  it("passes through Convex site URLs without a trailing slash", () => {
    assert.strictEqual(
      deriveSiteUrl("https://utmost-vulture-618.convex.site/"),
      "https://utmost-vulture-618.convex.site"
    );
  });

  it("returns null for localhost, empty, null, or non-Convex URLs", () => {
    assert.strictEqual(deriveSiteUrl("http://localhost:3210"), null);
    assert.strictEqual(deriveSiteUrl(""), null);
    assert.strictEqual(deriveSiteUrl(null), null);
    assert.strictEqual(deriveSiteUrl("https://example.com"), null);
  });
});

describe("buildAttachmentRequest", () => {
  it("builds the gated attachment request without putting the password in the URL", () => {
    const request = buildAttachmentRequest({
      siteUrl: "https://utmost-vulture-618.convex.site/",
      storageId: "kg2abc123",
      password: "top-secret",
    });

    assert.strictEqual(
      request.url,
      "https://utmost-vulture-618.convex.site/attachments/kg2abc123"
    );
    assert.deepStrictEqual(request.headers, {
      Authorization: "Bearer top-secret",
    });
    assert.ok(!request.url.includes("top-secret"));
  });
});

describe("describeFetchFailure", () => {
  it("describes known HTTP failures actionably", () => {
    assert.strictEqual(
      describeFetchFailure({ type: "http", status: 401, storageId: "kg2abc123" }),
      "Unauthorized: config.json password does not match the deployment's ADMIN_PASSWORD"
    );
    assert.strictEqual(
      describeFetchFailure({ type: "http", status: 404, storageId: "kg2abc123" }),
      "Attachment kg2abc123 not found — it was removed, or the storageId is wrong"
    );
    assert.strictEqual(
      describeFetchFailure({ type: "http", status: 413, storageId: "kg2abc123" }),
      "Attachment exceeds the 20 MB fetch limit; ask the user to re-share a smaller file"
    );
    assert.strictEqual(
      describeFetchFailure({ type: "http", status: 500, storageId: "kg2abc123" }),
      "Fetch failed with HTTP 500"
    );
  });

  it("describes network and site derivation failures", () => {
    assert.strictEqual(
      describeFetchFailure({
        type: "network",
        siteUrl: "https://utmost-vulture-618.convex.site",
        error: new Error("connection refused"),
      }),
      "Cannot reach https://utmost-vulture-618.convex.site: connection refused"
    );
    assert.strictEqual(
      describeFetchFailure({ type: "site-url", convexUrl: "http://localhost:3210" }),
      'Cannot derive the HTTP-actions host from convexUrl "http://localhost:3210"; set "convexSiteUrl" in config.json'
    );
  });
});

describe("successVerdict", () => {
  it("returns the single success verdict shape", () => {
    assert.deepStrictEqual(
      successVerdict({
        storageId: "kg2abc123",
        out: "/tmp/attachments/screenshot.png",
        bytes: 42,
        contentType: "image/png",
      }),
      {
        ok: true,
        storageId: "kg2abc123",
        out: "/tmp/attachments/screenshot.png",
        bytes: 42,
        contentType: "image/png",
      }
    );
  });
});

describe("backend contract parity", () => {
  it("mirrors backend constants and the rendered fetch command", async () => {
    const backendPath = resolve(process.cwd(), "workflow-engine/convex/lib/attachments.ts");
    if (!existsSync(backendPath)) return;

    const backend = await import(pathToFileURL(backendPath).href);

    assert.strictEqual(ATTACHMENT_ROUTE_PREFIX, backend.ATTACHMENT_ROUTE_PREFIX);
    assert.strictEqual(ATTACHMENT_AUTH_SCHEME, backend.ATTACHMENT_AUTH_SCHEME);
    assert.strictEqual(ATTACHMENT_FETCH_COMMAND, backend.ATTACHMENT_FETCH_COMMAND);
    assert.strictEqual(ATTACHMENT_MAX_BYTES, backend.ATTACHMENT_MAX_BYTES);

    const rendered = backend.renderAttachmentsBlock("Please inspect", [
      {
        filename: "screenshot.png",
        storageId: "kg2abc123",
        size: 188_621,
        mime: "image/png",
      },
    ]);
    const commandLine = rendered
      .split("\n")
      .find((line: string) => line.includes("attachment-fetch kg2abc123"));

    assert.ok(commandLine);
    assert.ok(
      commandLine
        .trimStart()
        .startsWith(
          "npx tsx .agents/tools/workflow/cli.ts attachment-fetch kg2abc123 --out "
        )
    );
  });
});
