import "server-only";
import { hash, verify } from "@node-rs/argon2";

export const MIN_PASSWORD = 12;

/** argon2id (the @node-rs/argon2 default) with its recommended cost parameters. */
export const hashPassword = (password: string) => hash(password);

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

// Unknown emails still pay for one verify, so response time doesn't reveal which emails exist.
let dummy: Promise<string> | undefined;
export async function burnVerify(password: string) {
  dummy ??= hash(crypto.randomUUID());
  await verifyPassword(await dummy, password);
}
