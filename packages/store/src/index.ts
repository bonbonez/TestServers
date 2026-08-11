import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";

/**
 * Shared credential store, backed by SQLite (better-sqlite3). This is the single source
 * of truth for the dummy creds every app uses: the config-server admin console reads and
 * writes it, and the mcp-server / oauth-server read it live on each request.
 *
 * TEST-ONLY: every value here is a throwaway dev placeholder. On first open the store
 * seeds itself from the current environment (or documented defaults), then the database
 * becomes authoritative.
 */

export interface Settings {
  mcpBearerToken: string;
  accessTokenAudience: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  authCodeTtlSeconds: number;
  requiredScope: string;
  apiStaticBearer: string;
  apiBasicUser: string;
  apiBasicPass: string;
  allowedRedirectUris: Array<string>;
  initialized: boolean;
}

export type Grant =
  | "authorization_code"
  | "client_credentials"
  | "refresh_token";

export interface OAuthClientRecord {
  clientId: string;
  clientSecret: string;
  grants: Array<Grant>;
  notes: string;
}

export interface CredentialSet {
  settings: Settings;
  clients: Array<OAuthClientRecord>;
}

function toNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function splitUris(value: string | undefined): Array<string> {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((uri) => uri.trim())
    .filter(Boolean);
}

function seedSettings(): Settings {
  return {
    mcpBearerToken: process.env.MCP_BEARER_TOKEN ?? "dev-mcp-bearer-token-abc123",
    accessTokenAudience: process.env.ACCESS_TOKEN_AUDIENCE ?? "mcp-test",
    accessTokenTtlSeconds: toNumber(process.env.ACCESS_TOKEN_TTL_SECONDS, 120),
    refreshTokenTtlSeconds: toNumber(process.env.REFRESH_TOKEN_TTL_SECONDS, 86400),
    authCodeTtlSeconds: toNumber(process.env.AUTH_CODE_TTL_SECONDS, 300),
    requiredScope: process.env.MCP_OAUTH_REQUIRED_SCOPE ?? "read",
    apiStaticBearer: process.env.API_STATIC_BEARER ?? "dev-api-static-bearer-token",
    apiBasicUser: process.env.API_BASIC_USER ?? "api-basic-user",
    apiBasicPass: process.env.API_BASIC_PASS ?? "dev-api-basic-pass",
    allowedRedirectUris: splitUris(process.env.OAUTH_ALLOWED_REDIRECT_URIS),
    initialized: false,
  };
}

const SEED_CLIENTS: Array<OAuthClientRecord> = [
  {
    clientId: "mcp-authcode-client",
    clientSecret: "dev-mcp-authcode-secret",
    grants: ["authorization_code", "refresh_token"],
    notes: "MCP popup (authorization-code) flow.",
  },
  {
    clientId: "mcp-cc-client",
    clientSecret: "dev-mcp-cc-secret",
    grants: ["client_credentials"],
    notes: "MCP client-credentials mode.",
  },
  {
    clientId: "api-cred-client",
    clientSecret: "dev-api-cred-secret",
    grants: ["client_credentials"],
    notes: "OAuth API credential (client-credentials).",
  },
];

function findRepoRoot(startDir: string): string {
  let dir = startDir;
  for (;;) {
    if (existsSync(join(dir, "yarn.lock"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return startDir;
    }
    dir = parent;
  }
}

function resolveDbPath(): string {
  const configured = process.env.CREDS_DB_PATH;
  if (configured) {
    return configured;
  }
  const dataDir = join(findRepoRoot(process.cwd()), ".data");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  return join(dataDir, "creds.db");
}

const SETTINGS_KEYS: Array<keyof Settings> = [
  "mcpBearerToken",
  "accessTokenAudience",
  "accessTokenTtlSeconds",
  "refreshTokenTtlSeconds",
  "authCodeTtlSeconds",
  "requiredScope",
  "apiStaticBearer",
  "apiBasicUser",
  "apiBasicPass",
  "allowedRedirectUris",
  "initialized",
];

export interface Store {
  getSettings(): Settings;
  updateSettings(patch: Partial<Settings>): Settings;
  listClients(): Array<OAuthClientRecord>;
  getClient(clientId: string): OAuthClientRecord | undefined;
  verifyClient(clientId: string, clientSecret: string): OAuthClientRecord | undefined;
  upsertClient(record: OAuthClientRecord): OAuthClientRecord;
  deleteClient(clientId: string): void;
  getCredentialSet(): CredentialSet;
  close(): void;
}

export function openStore(dbPath: string = resolveDbPath()): Store {
  // busy_timeout lets concurrent app processes wait rather than fail with SQLITE_BUSY
  // when they open (and seed) the shared database at the same time.
  const db = new Database(dbPath, { timeout: 5000 });
  if (dbPath !== ":memory:") {
    db.pragma("journal_mode = WAL");
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS clients (
      client_id TEXT PRIMARY KEY,
      client_secret TEXT NOT NULL,
      grants TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT ''
    );
  `);

  const writeSetting = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  );
  const readSettings = db.prepare("SELECT key, value FROM settings");
  const upsertClientStmt = db.prepare(
    "INSERT INTO clients (client_id, client_secret, grants, notes) VALUES (@clientId, @clientSecret, @grants, @notes) " +
      "ON CONFLICT(client_id) DO UPDATE SET client_secret = excluded.client_secret, grants = excluded.grants, notes = excluded.notes",
  );

  function persistSettings(settings: Settings): void {
    const write = db.transaction((value: Settings) => {
      for (const key of SETTINGS_KEYS) {
        writeSetting.run(key, JSON.stringify(value[key]));
      }
    });
    write(settings);
  }

  function readAllSettings(): Settings {
    const rows = readSettings.all() as Array<{ key: string; value: string }>;
    const defaults = seedSettings();
    const result = { ...defaults };
    for (const row of rows) {
      if ((SETTINGS_KEYS as Array<string>).includes(row.key)) {
        (result as Record<string, unknown>)[row.key] = JSON.parse(row.value);
      }
    }
    return result;
  }

  function readClients(): Array<OAuthClientRecord> {
    const rows = db
      .prepare("SELECT client_id, client_secret, grants, notes FROM clients ORDER BY client_id")
      .all() as Array<{
      client_id: string;
      client_secret: string;
      grants: string;
      notes: string;
    }>;
    return rows.map((row) => ({
      clientId: row.client_id,
      clientSecret: row.client_secret,
      grants: JSON.parse(row.grants),
      notes: row.notes,
    }));
  }

  // Seed on first open: an empty settings table means a brand-new database.
  const alreadySeeded = (readSettings.get() as unknown) !== undefined;
  if (!alreadySeeded) {
    persistSettings(seedSettings());
    const seedClients = db.transaction((clients: Array<OAuthClientRecord>) => {
      for (const client of clients) {
        upsertClientStmt.run({
          clientId: client.clientId,
          clientSecret: client.clientSecret,
          grants: JSON.stringify(client.grants),
          notes: client.notes,
        });
      }
    });
    seedClients(SEED_CLIENTS);
  }

  return {
    getSettings: readAllSettings,
    updateSettings(patch) {
      const next = { ...readAllSettings(), ...patch };
      persistSettings(next);
      return next;
    },
    listClients: readClients,
    getClient(clientId) {
      return readClients().find((client) => client.clientId === clientId);
    },
    verifyClient(clientId, clientSecret) {
      const client = readClients().find((c) => c.clientId === clientId);
      if (!client || client.clientSecret !== clientSecret) {
        return undefined;
      }
      return client;
    },
    upsertClient(record) {
      upsertClientStmt.run({
        clientId: record.clientId,
        clientSecret: record.clientSecret,
        grants: JSON.stringify(record.grants),
        notes: record.notes,
      });
      return record;
    },
    deleteClient(clientId) {
      db.prepare("DELETE FROM clients WHERE client_id = ?").run(clientId);
    },
    getCredentialSet() {
      return { settings: readAllSettings(), clients: readClients() };
    },
    close() {
      db.close();
    },
  };
}
