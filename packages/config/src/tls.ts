import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { generate } from "selfsigned";

/**
 * TLS material resolution for the backends.
 *
 * TEST-ONLY: when no explicit cert is provided the servers use a cached self-signed dev
 * certificate for localhost/127.0.0.1. It is a throwaway convenience — browsers show a
 * one-time warning and service-to-service calls skip verification in dev.
 */

export interface TlsEnv {
  TLS: boolean;
  TLS_CERT?: string;
  TLS_KEY?: string;
}

export interface TlsOptions {
  key: string | Buffer;
  cert: string | Buffer;
}

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

function writeAtomic(path: string, contents: string): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, contents);
  renameSync(tmp, path);
}

export async function resolveTlsOptions(
  env: TlsEnv,
): Promise<TlsOptions | null> {
  if (!env.TLS) {
    return null;
  }
  if (env.TLS_CERT && env.TLS_KEY) {
    return {
      cert: readFileSync(env.TLS_CERT),
      key: readFileSync(env.TLS_KEY),
    };
  }

  const keysDir = join(findRepoRoot(process.cwd()), ".keys");
  const certPath = join(keysDir, "dev-cert.pem");
  const keyPath = join(keysDir, "dev-key.pem");
  if (existsSync(certPath) && existsSync(keyPath)) {
    return { cert: readFileSync(certPath), key: readFileSync(keyPath) };
  }

  const pems = await generate([{ name: "commonName", value: "localhost" }], {
    keySize: 2048,
    algorithm: "sha256",
    extensions: [
      { name: "basicConstraints", cA: false },
      { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
      {
        name: "subjectAltName",
        altNames: [
          { type: 2, value: "localhost" },
          { type: 7, ip: "127.0.0.1" },
          { type: 7, ip: "::1" },
        ],
      },
    ],
  });

  mkdirSync(keysDir, { recursive: true });
  writeAtomic(certPath, pems.cert);
  writeAtomic(keyPath, pems.private);
  return { cert: pems.cert, key: pems.private };
}
