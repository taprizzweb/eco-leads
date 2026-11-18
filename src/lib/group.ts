import { notFound } from "next/navigation";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

export type GroupInfo = { id: string; slug: string; name: string; logo_url: string | null };
export type Overview = { branches: number; taps: number; drafts: number; copied: number; feedback_open: number; customers: number; whatsapp_ready: number | null; reviews: number; avg_rating: number | null; approx?: boolean };
export type BranchRow = { client_id: string; slug: string; name: string; status: string; taps: number; drafts: number; copied: number; feedback_open: number; customers: number; avg_rating: number | null };

// Row-level security decides access: someone who is not the head of this chain simply gets no row and sees a 404.
export const loadGroup = cache(async (slug: string) => {
  const sb = await supabaseServer();
  const { data } = await sb.from("groups").select("id, slug, name, logo_url").eq("slug", slug).maybeSingle();
  if (!data) notFound();
  return { sb, group: data as GroupInfo };
});

const missing = (e: { code?: string; message?: string } | null) => !!e && /could not find the function|PGRST202|schema cache/i.test(`${e.code ?? ""} ${e.message ?? ""}`);
const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;

export async function groupOverview(sb: SupabaseClient, g: GroupInfo, days: number): Promise<Overview> {
  const { data, error } = await sb.rpc("group_overview", { p_group: g.id, p_days: days });
  if (!error && data) return data as Overview;
  if (!missing(error)) throw new Error(error?.message ?? "group_overview failed");
  // The database function is not there yet: add the numbers up from the branches directly.
  const { data: cl } = await sb.from("clients").select("id").eq("group_id", g.id);
  const ids = (cl ?? []).map((c) => c.id as string);
  if (!ids.length) return { branches: 0, taps: 0, drafts: 0, copied: 0, feedback_open: 0, customers: 0, whatsapp_ready: null, reviews: 0, avg_rating: null, approx: true };
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const head = { count: "exact" as const, head: true };
  const [taps, drafts, copied, fb, cust, rev] = await Promise.all([
    count(sb.from("taps").select("id", head).in("client_id", ids).gte("created_at", since)),
    count(sb.from("review_drafts").select("id", head).in("client_id", ids).gte("created_at", since)),
    count(sb.from("review_drafts").select("id", head).in("client_id", ids).gte("created_at", since).eq("copied", true)),
    count(sb.from("feedback").select("id", head).in("client_id", ids).eq("status", "new")),
    count(sb.from("contacts").select("id", head).in("client_id", ids)),
    count(sb.from("google_reviews").select("id", head).in("client_id", ids).gte("created_at", since)),
  ]);
  return { branches: ids.length, taps, drafts, copied, feedback_open: fb, customers: cust, whatsapp_ready: null, reviews: rev, avg_rating: null, approx: true };
}

export async function groupBranches(sb: SupabaseClient, g: GroupInfo, o: { days: number; search: string; sort: string; page: number; size: number }): Promise<{ rows: BranchRow[]; total: number }> {
  const { data, error } = await sb.rpc("group_branches", { p_group: g.id, p_days: o.days, p_search: o.search, p_sort: o.sort, p_limit: o.size, p_offset: o.page * o.size });
  if (!error && data) {
    const rows = (data as (BranchRow & { total: number })[]).map((r) => ({ ...r, taps: Number(r.taps), drafts: Number(r.drafts), copied: Number(r.copied), feedback_open: Number(r.feedback_open), customers: Number(r.customers), avg_rating: r.avg_rating == null ? null : Number(r.avg_rating) }));
    return { rows, total: rows[0] ? Number((data as { total: number }[])[0].total) : 0 };
  }
  if (!missing(error)) throw new Error(error?.message ?? "group_branches failed");
  let q = sb.from("clients").select("id, slug, name, status", { count: "exact" }).eq("group_id", g.id).order("name").range(o.page * o.size, o.page * o.size + o.size - 1);
  if (o.search) q = q.ilike("name", `%${o.search.replace(/[%_]/g, "")}%`);
  const { data: cl, count: total } = await q;
  const since = new Date(Date.now() - o.days * 864e5).toISOString();
  const head = { count: "exact" as const, head: true };
  const rows = await Promise.all((cl ?? []).map(async (c) => {
    const [taps, drafts, copied, fb, cust] = await Promise.all([
      count(sb.from("taps").select("id", head).eq("client_id", c.id).gte("created_at", since)),
      count(sb.from("review_drafts").select("id", head).eq("client_id", c.id).gte("created_at", since)),
      count(sb.from("review_drafts").select("id", head).eq("client_id", c.id).gte("created_at", since).eq("copied", true)),
      count(sb.from("feedback").select("id", head).eq("client_id", c.id).eq("status", "new")),
      count(sb.from("contacts").select("id", head).eq("client_id", c.id)),
    ]);
    return { client_id: c.id, slug: c.slug, name: c.name, status: String(c.status), taps, drafts, copied, feedback_open: fb, customers: cust, avg_rating: null } as BranchRow;
  }));
  return { rows, total: total ?? rows.length };
}
