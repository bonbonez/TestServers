/**
 * Tiny dependency-free logger for the backends.
 *
 * When the target stream is a TTY it prints a compact, colorized line; when the output is
 * piped or redirected it prints one JSON object per line so logs stay machine-readable.
 * Colors can be disabled with NO_COLOR; the level threshold is set with LOG_LEVEL.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  /** Log one HTTP request; the level is derived from the status code. */
  http(method: string, path: string, status: number, durationMs: number): void;
}

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
} as const;

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const LEVEL_COLOR: Record<LogLevel, string> = {
  debug: ANSI.gray,
  info: ANSI.green,
  warn: ANSI.yellow,
  error: ANSI.red,
};

function thresholdFromEnv(): number {
  const configured = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  return LEVEL_ORDER[configured as LogLevel] ?? LEVEL_ORDER.info;
}

const colorAllowed = !process.env.NO_COLOR;

function paint(useColor: boolean, code: string, text: string): string {
  return useColor ? `${code}${text}${ANSI.reset}` : text;
}

function statusColor(status: number): string {
  if (status >= 500) {
    return ANSI.red;
  }
  if (status >= 400) {
    return ANSI.yellow;
  }
  if (status >= 300) {
    return ANSI.cyan;
  }
  return ANSI.green;
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

function formatPretty(
  useColor: boolean,
  app: string,
  level: LogLevel,
  message: string,
  fields: Record<string, unknown>,
): string {
  const time = new Date().toISOString().slice(11, 23);
  const label = paint(useColor, LEVEL_COLOR[level], level.toUpperCase().padEnd(5));
  const head = `${paint(useColor, ANSI.gray, time)} ${label} ${paint(
    useColor,
    ANSI.bold + ANSI.cyan,
    app,
  )}`;
  const parts = Object.entries(fields).map(
    ([key, value]) =>
      ` ${paint(useColor, ANSI.gray, `${key}=`)}${paint(useColor, ANSI.dim, formatValue(value))}`,
  );
  return `${head} ${message}${parts.join("")}`;
}

function formatJson(
  app: string,
  level: LogLevel,
  message: string,
  fields: Record<string, unknown>,
): string {
  return JSON.stringify({
    time: new Date().toISOString(),
    level,
    app,
    msg: message,
    ...fields,
  });
}

export function createLogger(app: string): Logger {
  const threshold = thresholdFromEnv();

  const emit = (
    level: LogLevel,
    message: string,
    fields: Record<string, unknown>,
  ) => {
    if (LEVEL_ORDER[level] < threshold) {
      return;
    }
    const stream = level === "warn" || level === "error" ? process.stderr : process.stdout;
    const useColor = Boolean(stream.isTTY) && colorAllowed;
    const line = useColor
      ? formatPretty(useColor, app, level, message, fields)
      : formatJson(app, level, message, fields);
    stream.write(`${line}\n`);
  };

  return {
    debug: (message, fields) => emit("debug", message, fields ?? {}),
    info: (message, fields) => emit("info", message, fields ?? {}),
    warn: (message, fields) => emit("warn", message, fields ?? {}),
    error: (message, fields) => emit("error", message, fields ?? {}),
    http: (method, path, status, durationMs) => {
      const level: LogLevel =
        status >= 500 ? "error" : status >= 400 ? "warn" : "info";
      if (LEVEL_ORDER[level] < threshold) {
        return;
      }
      const stream = level === "info" ? process.stdout : process.stderr;
      const useColor = Boolean(stream.isTTY) && colorAllowed;
      if (useColor) {
        const time = new Date().toISOString().slice(11, 23);
        const label = paint(useColor, LEVEL_COLOR[level], level.toUpperCase().padEnd(5));
        const line =
          `${paint(useColor, ANSI.gray, time)} ${label} ` +
          `${paint(useColor, ANSI.bold + ANSI.cyan, app)} ` +
          `${paint(useColor, ANSI.blue, method.padEnd(4))} ${path} ` +
          `${paint(useColor, statusColor(status), String(status))} ` +
          `${paint(useColor, ANSI.dim, `${durationMs}ms`)}`;
        stream.write(`${line}\n`);
        return;
      }
      stream.write(
        `${formatJson(app, level, `${method} ${path}`, { status, durationMs })}\n`,
      );
    },
  };
}

// Minimal structural shapes so this package stays dependency-free (no express types).
interface HttpRequestLike {
  method: string;
  originalUrl?: string;
  url?: string;
  path?: string;
}

interface HttpResponseLike {
  statusCode: number;
  on(event: "finish", listener: () => void): unknown;
}

/**
 * Express-compatible middleware that logs one line per finished request. Kept structurally
 * typed so the logger package needs no express dependency.
 */
export function httpLogger(logger: Logger) {
  return (req: HttpRequestLike, res: HttpResponseLike, next: () => void): void => {
    const start = Date.now();
    res.on("finish", () => {
      logger.http(req.method, req.path ?? req.url ?? "", res.statusCode, Date.now() - start);
    });
    next();
  };
}
