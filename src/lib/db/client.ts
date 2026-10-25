/**
 * Database access. One Postgres schema, two drivers:
 *   - hosted: Supabase Postgres via DATABASE_URL (`postgres` driver, transaction pooler)
 *   - local:  PGlite (Postgres compiled to WASM), persisted to data/pgdata — no install needed
 *
 * All user work goes through `asPrincipal`, which runs inside a transaction as the
 * `authenticated` role with the user's id in the JWT claims, so Row Level Security applies.
 * `asAdmin` is for migrations, seeding and usage accounting only.
 */
import fs from "node:fs";
import path from "node:path";

export interface Sql {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /** Run a multi-statement script with no parameters (migrations only). */
  exec(script: string): Promise<void>;
}

export interface Principal {
  userId: string;
  /** Set only for visitors using a shared demo login; isolates their personal demo copy. */
  demoSessionId: string | null;
}

export interface Database {
  readonly driver: "pglite" | "postgres";
  asPrincipal<T>(principal: Principal, fn: (sql: Sql) => Promise<T>): Promise<T>;
  asAdmin<T>(fn: (sql: Sql) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertUuid(value: string, label = "id"): void {
  if (!UUID_RE.test(value)) throw new Error(`invalid ${label}`);
}

function claimsFor(p: Principal): string {
  assertUuid(p.userId, "user id");
  if (p.demoSessionId) assertUuid(p.demoSessionId, "demo session id");
  return JSON.stringify({ sub: p.userId, role: "authenticated", demo_session: p.demoSessionId ?? "" });
}

// ---------------- PGlite (local) ----------------
async function createPglite(dataDir: string | null): Promise<Database> {
  const { PGlite } = await import("@electric-sql/pglite");
  if (dataDir) fs.mkdirSync(dataDir, { recursive: true });
  const pg = dataDir ? new PGlite(dataDir) : new PGlite();
  await pg.waitReady;

  type Q = { query: (t: string, p?: unknown[]) => Promise<{ rows: unknown[] }>; exec: (s: string) => Promise<unknown> };
  const wrap = (q: Q): Sql => ({
    async query<T>(text: string, params?: unknown[]) {
      return (await q.query(text, params)).rows as T[];
    },
    async exec(script: string) {
      await q.exec(script);
    },
  });

  return {
    driver: "pglite",
    asPrincipal(p, fn) {
      const claims = claimsFor(p);
      return pg.transaction(async (tx) => {
        await tx.query("select set_config('request.jwt.claims', $1, true)", [claims]);
        await tx.exec("set local role authenticated");
        return fn(wrap(tx));
      });
    },
    asAdmin(fn) {
      return pg.transaction(async (tx) => fn(wrap(tx)));
    },
    async close() {
      await pg.close();
    },
  };
}

// ---------------- Postgres (hosted, Supabase) ----------------
async function createPostgres(url: string): Promise<Database> {
  const { default: postgres } = await import("postgres");
  // prepare:false is required by Supabase's transaction pooler.
  const sql = postgres(url, { prepare: false, max: 3, idle_timeout: 20, connect_timeout: 10, onnotice: () => {} });

  type Tx = { unsafe: (t: string, p?: unknown[]) => Promise<unknown[]> };
  const wrap = (tx: Tx): Sql => ({
    async query<T>(text: string, params?: unknown[]) {
      return (await tx.unsafe(text, (params ?? []) as never[])) as T[];
    },
    async exec(script: string) {
      await tx.unsafe(script); // no params -> simple protocol, multi-statement allowed
    },
  });

  return {
    driver: "postgres",
    asPrincipal(p, fn) {
      const claims = claimsFor(p);
      return sql.begin(async (tx) => {
        await tx.unsafe("select set_config('request.jwt.claims', $1, true)", [claims]);
        await tx.unsafe("set local role authenticated");
        return fn(wrap(tx as unknown as Tx));
      }) as Promise<never>;
    },
    asAdmin(fn) {
      return sql.begin(async (tx) => fn(wrap(tx as unknown as Tx))) as Promise<never>;
    },
    async close() {
      await sql.end();
    },
  };
}

// ---------------- Factory ----------------
/** Folder for the local database; ":memory:" means in-memory (tests). */
export function localDataDir(): string | null {
  const dir = process.env.CARESIGNAL_PGLITE_DIR;
  if (dir === ":memory:") return null;
  return dir || path.join(process.cwd(), "data", "pgdata");
}

export async function createDatabase(opts: { url?: string | null; dataDir?: string | null } = {}): Promise<Database> {
  if (opts.url) return createPostgres(opts.url);
  return createPglite(opts.dataDir === undefined ? localDataDir() : opts.dataDir);
}
