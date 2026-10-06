import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

/**
 * The one Prisma client, over the pooled DATABASE_URL (Supavisor, transaction mode), so
 * serverless functions don't exhaust Postgres connections. Reused across hot reloads in dev.
 */
const g = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  g.prisma ?? new PrismaClient({ adapter: new PrismaPg({ connectionString: requireEnv("DATABASE_URL") }) });

if (process.env.NODE_ENV !== "production") g.prisma = db;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set. Copy .env.example to .env.local and fill it in.`);
  return v;
}
