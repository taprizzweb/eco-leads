import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Calls one of the review database functions with the server key (REVIEW_SERVER_KEY).
 * Only this server knows the key, so people cannot call those functions straight from the internet.
 * While the database still has only the older version of a function, the older call is used.
 */
export async function rpcKeyed(sb: SupabaseClient, fn: string, args: Record<string, unknown>) {
  const key = process.env.REVIEW_SERVER_KEY;
  if (key) {
    const r = await sb.rpc(fn, { ...args, p_key: key });
    if (!r.error || !/could not find the function|PGRST202|schema cache/i.test(`${r.error.code ?? ""} ${r.error.message}`)) return r;
  }
  return sb.rpc(fn, args);
}
