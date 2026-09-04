#!/usr/bin/env npx tsx
// Uploads a built APK to Convex file storage and prints the download URL.
// The link is Convex's unguessable-but-public storage URL (see convex/files.ts)
// — fine for the APK, which carries no secrets.
//
// Usage (from repo root or anywhere):
//   npx tsx workflow-engine/android-shell/scripts/upload-apk.ts [path-to-apk]
//
// Defaults to the debug build output. Reads convexUrl + password from
// .agents/tools/workflow/config.json.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");

const apkPath = resolve(
  process.argv[2] ??
    resolve(scriptDir, "../android/app/build/outputs/apk/debug/app-debug.apk"),
);

const config = JSON.parse(
  readFileSync(resolve(repoRoot, ".agents/tools/workflow/config.json"), "utf8"),
) as { convexUrl: string; password: string };

async function main() {
  const apk = readFileSync(apkPath);
  console.error(`Uploading ${apkPath} (${(apk.length / 1024 / 1024).toFixed(1)} MB)...`);

  const client = new ConvexHttpClient(config.convexUrl);
  const uploadUrl: string = await client.mutation(anyApi.files.generateUploadUrl, {
    password: config.password,
  });

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "application/vnd.android.package-archive" },
    body: apk,
  });
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${await response.text()}`);
  }
  const { storageId } = (await response.json()) as { storageId: string };

  const downloadUrl: string | null = await client.query(anyApi.files.getDownloadUrl, {
    password: config.password,
    storageId,
  });
  if (!downloadUrl) throw new Error(`No download URL for storageId ${storageId}`);

  console.log(downloadUrl);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
