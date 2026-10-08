import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * The storage bucket with the service-role key: server only, never NEXT_PUBLIC_. Only the server
 * writes to storage; browsers upload through one-off signed URLs (lib/admin/uploads.ts).
 */
let client: ReturnType<typeof make> | undefined;
function make() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from(process.env.SUPABASE_BUCKET ?? "brand-assets");
}
export const bucket = () => (client ??= make());
