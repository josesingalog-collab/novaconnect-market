import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const SERVICE_ROLE_MESSAGE =
  "Client Supabase service-role : serveur uniquement, import autorisé uniquement depuis lib/supabase/admin.ts.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    // Sécurité : le client admin (service role) ne peut être importé que par lui-même.
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["lib/supabase/admin.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@/lib/supabase/admin", message: SERVICE_ROLE_MESSAGE },
            { name: "@/lib/supabase/admin.js", message: SERVICE_ROLE_MESSAGE },
          ],
          patterns: [
            { group: ["**/supabase/admin", "**/supabase/admin.*"], message: SERVICE_ROLE_MESSAGE },
          ],
        },
      ],
    },
  },
  {
    // Sécurité : process.env accessible uniquement dans les modules de configuration.
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["lib/env.ts", "lib/config.ts", "next.config.ts", "vitest.config.mts", "tests/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message:
            "Utiliser lib/env.ts (validation Zod) ou lib/config.ts. Accès direct à process.env interdit.",
        },
      ],
    },
  },
]);

export default eslintConfig;
