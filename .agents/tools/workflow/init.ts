#!/usr/bin/env npx tsx
/**
 * Workflow Init Script
 *
 * Initializes the namespace in the Convex database based on config.json.
 * This script is idempotent - running it multiple times won't create duplicates.
 *
 * Usage:
 *   npx tsx init.ts
 */

import { ConvexClient } from "convex/browser";
import { anyApi } from "convex/server";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const api = anyApi;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Config {
  convexUrl: string;
  namespace: string;
  defaultHarness?: string;
  timeoutMs?: number;
  pmHarness?: string;
}

function loadConfig(): Config {
  const configPath = join(__dirname, "config.json");
  if (!existsSync(configPath)) {
    console.error("Error: config.json not found at", configPath);
    console.error("Please copy config.example.json to config.json and configure it.");
    process.exit(1);
  }
  return JSON.parse(readFileSync(configPath, "utf-8"));
}

async function main() {
  const config = loadConfig();
  console.log(`Initializing namespace: ${config.namespace}`);
  console.log(`Convex URL: ${config.convexUrl}`);

  const client = new ConvexClient(config.convexUrl);

  try {
    // Check if namespace already exists
    const existing = await client.query(api.namespaces.getByName, {
      name: config.namespace,
    });

    if (existing) {
      console.log(`Namespace "${config.namespace}" already exists with ID: ${existing._id}`);
      console.log("No action needed - idempotent check passed.");
    } else {
      // Create the namespace
      const namespaceId = await client.mutation(api.namespaces.create, {
        name: config.namespace,
        description: `Namespace for ${config.namespace} repo`,
      });
      console.log(`Created namespace "${config.namespace}" with ID: ${namespaceId}`);
    }

    console.log("\nInit complete!");
  } catch (error) {
    console.error("Error during init:", error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
