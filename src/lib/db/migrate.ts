/**
 * Applies SQL migrations in order and records them in schema_migrations.
 * Local mode also applies db/local/* first (auth stub + local credentials).
 */
import fs from "node:fs";
import path from "node:path";
import type { Database } from "./client";

export function migrationDirs(root = process.cwd()) {
  return { local: path.join(root, "db", "local"), shared: path.join(root, "db", "migrations") };
}

function sqlFiles(dir: string): { name: string; sql: string }[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: fs.readFileSync(path.join(dir, name), "utf8") }));
}

export async function migrate(db: Database, root = process.cwd()): Promise<string[]> {
  const dirs = migrationDirs(root);
  const files = [
    ...(db.driver === "pglite" ? sqlFiles(dirs.local).map((f) => ({ ...f, name: `local/${f.name}` })) : []),
    ...sqlFiles(dirs.shared),
  ];

  return db.asAdmin(async (sql) => {
    await sql.query(
      "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    const done = new Set((await sql.query<{ name: string }>("select name from schema_migrations")).map((r) => r.name));
    const applied: string[] = [];
    for (const f of files) {
      if (done.has(f.name)) continue;
      await sql.exec(f.sql);
      await sql.query("insert into schema_migrations (name) values ($1)", [f.name]);
      applied.push(f.name);
    }
    return applied;
  });
}
