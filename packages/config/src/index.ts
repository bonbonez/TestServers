import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { config as loadDotenv } from "dotenv";
import type { Logger } from "@test-servers/logger";
import { z } from "zod";

/**
 * Env parsing + safe boot logging shared by the backends.
 *
 * TEST-ONLY note: config is intentionally simple — parse `process.env` against a zod
 * schema, fail fast on bad input, and log the effective config with secrets redacted.
 */

/**
 * Load the monorepo root `.env` (if present) into `process.env`, without overriding
 * anything already set. Apps run from their own directory, so we walk up to find it.
 */
function loadRootEnv(): void {
  let dir = process.cwd();
  for (;;) {
    const candidate = join(dir, ".env");
    if (existsSync(candidate)) {
      loadDotenv({ path: candidate, override: false });
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return;
    }
    dir = parent;
  }
}

/**
 * Parse `process.env` against `schema`. On failure, print a readable error and exit —
 * a misconfigured test server should never limp along in a half-valid state.
 */
export function loadConfig<T extends z.ZodTypeAny>(schema: T): z.infer<T> {
  loadRootEnv();
  const result = schema.safeParse(process.env);
  if (!result.success) {
    console.error("[config] invalid environment:");
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}

const SECRET_KEY_PATTERN = /secret|token|password|pass|key/i;

function redact(key: string, value: unknown): unknown {
  if (SECRET_KEY_PATTERN.test(key) && value) {
    return "***redacted***";
  }
  return value;
}

/**
 * Log the effective config at boot with secret-looking values redacted, and warn loudly
 * when the server is bound wider than localhost.
 */
export function logBootConfig(
  logger: Logger,
  config: Record<string, unknown>,
): void {
  const redacted = Object.fromEntries(
    Object.entries(config).map(([key, value]) => [key, redact(key, value)]),
  );
  logger.info("starting", redacted);

  if (config.HOST && config.HOST !== "127.0.0.1" && config.HOST !== "localhost") {
    logger.warn(
      "bound wider than localhost — this test server is NOT secure and must never be exposed to a public network",
      { host: config.HOST },
    );
  }
}

export { resolveTlsOptions, type TlsEnv, type TlsOptions } from "./tls.js";

export { z };
