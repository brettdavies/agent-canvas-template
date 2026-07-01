import { defineConfig } from 'drizzle-kit';

// Generate-only config for the D1 (SQLite) schema, kept separate from the Postgres
// drizzle.config.ts. Migrations land in worker/migrations/ and are applied to remote
// D1 with `wrangler d1 migrations apply agent-canvas --remote`.
export default defineConfig({
  dialect: 'sqlite',
  schema: './worker/db/schema.ts',
  out: './worker/migrations',
});
