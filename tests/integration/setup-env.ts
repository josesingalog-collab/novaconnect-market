/**
 * Charge .env.local dans process.env AVANT tout module Supabase.
 * Exécuté comme setupFile par vitest.integration.config.mts.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");

try {
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (match !== null) {
      const key = match[1];
      const value = match[2]?.trim() ?? "";
      if (key !== undefined && process.env[key] === undefined && value.length > 0) {
        process.env[key] = value;
      }
    }
  }
} catch {
  throw new Error(
    ".env.local introuvable : les tests d'intégration nécessitent un projet Supabase configuré.",
  );
}
