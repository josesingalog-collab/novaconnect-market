import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const PRODUCTION_PROJECT_REF = "hjypzypvxftohpnxflcq";

export function loadIntegrationEnv() {
  const envPath = resolve(process.cwd(), ".env.integration");

  try {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
      if (match !== null) {
        const key = match[1];
        const value = match[2]?.trim() ?? "";
        if (key !== undefined && value.length > 0) {
          process.env[key] = value;
        }
      }
    }
  } catch {
    throw new Error(
      ".env.integration introuvable : les tests d'intégration nécessitent Supabase local.",
    );
  }

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Variable ${key} absente de .env.integration.`);
    }
  }

  const integrationUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  const target = process.env.INTEGRATION_TEST_TARGET ?? "local";

  if (target === "local") {
    if (["localhost", "127.0.0.1", "::1"].includes(integrationUrl.hostname)) return;
    throw new Error(
      "Les tests d'intégration sont limités à Supabase local. Une URL distante est refusée pour protéger les données de l'application.",
    );
  }

  if (target !== "remote") {
    throw new Error("INTEGRATION_TEST_TARGET doit être local ou remote.");
  }

  const projectRef = process.env.INTEGRATION_SUPABASE_PROJECT_REF;
  if (!projectRef) {
    throw new Error("INTEGRATION_SUPABASE_PROJECT_REF est requis pour un projet de test distant.");
  }
  if (projectRef === PRODUCTION_PROJECT_REF) {
    throw new Error("Le projet Supabase de production ne peut jamais servir aux tests d'intégration.");
  }
  if (process.env.INTEGRATION_REMOTE_TEST_ACKNOWLEDGEMENT !== "dedicated-test-project") {
    throw new Error("Confirmez le projet de test dédié avec INTEGRATION_REMOTE_TEST_ACKNOWLEDGEMENT.");
  }
  if (integrationUrl.hostname !== `${projectRef}.supabase.co`) {
    throw new Error("L'URL Supabase ne correspond pas au projet de test déclaré.");
  }
}
