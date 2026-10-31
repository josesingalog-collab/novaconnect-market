/**
 * Charge l'environnement local dans chaque worker avant les modules Supabase.
 * Exécuté comme setupFile par vitest.integration.config.mts.
 */
import { loadIntegrationEnv } from "./env";

loadIntegrationEnv();
