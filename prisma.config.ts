import fs from "node:fs";
import { defineConfig } from "prisma/config";

// The Prisma CLI doesn't read .env.local; Next.js does. Load it so both use the same file.
if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // Migrations need a direct (session) connection; the app uses the pooled DATABASE_URL.
  datasource: {
    url: process.env.DIRECT_URL,
  },
});
