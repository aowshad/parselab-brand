/**
 * `pnpm admin:reset -- --email you@example.com`: sets a new admin password from the terminal
 * (typed twice, hidden) and signs out every session. The only way to recover a lost password:
 * there's deliberately no email-based reset.
 */
import fs from "node:fs";
import readline from "node:readline";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");

const MIN_PASSWORD = 12;
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

/** Reads one line without echoing it. Piped input (for scripts and tests) is read as-is. */
function ask(prompt: string, lines?: AsyncIterator<string>): Promise<string> {
  if (lines) return lines.next().then((r) => (r.done ? "" : r.value));
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    out._writeToOutput = (s: string) => out.output.write(s.startsWith(prompt) ? s : s.includes("\n") ? "\n" : "");
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  if (!email) throw new Error("Usage: pnpm admin:reset -- --email you@example.com");
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("DIRECT_URL / DATABASE_URL is not set (.env.local).");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const admin = await db.admin.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
    if (!admin) throw new Error(`No admin with the email ${email}.`);

    const reader = process.stdin.isTTY ? undefined : readline.createInterface({ input: process.stdin });
    const piped = reader?.[Symbol.asyncIterator]();
    const password = await ask("New password (12+ characters): ", piped);
    const again = await ask("Type it again: ", piped);
    reader?.close();
    if (password.length < MIN_PASSWORD) throw new Error(`Password must be at least ${MIN_PASSWORD} characters.`);
    if (again !== password) throw new Error("The passwords don't match. Nothing changed.");

    await db.admin.update({ where: { id: admin.id }, data: { passwordHash: await hash(password) } });
    const { count } = await db.session.deleteMany({ where: { adminId: admin.id } });
    console.log(`✓ Password reset for ${admin.email}. ${count} session${count === 1 ? "" : "s"} signed out.`);
  } finally {
    await db.$disconnect();
  }
}

// Exit explicitly: an open stdin reader or the database pool would otherwise keep the process
// alive after the work is done (and anything waiting on it, like a test, would wait forever).
main()
  .catch((e) => {
    console.error(`✗ ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode ?? 0));
