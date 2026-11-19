import { cache } from "react";
import { supabaseServer } from "@/lib/supabase/server";
import type { HubHome, HubPlaceFull } from "@/lib/hub-shared";

export * from "@/lib/hub-shared";

export const loadHub = cache(async (area: string, cat: string): Promise<HubHome> => {
  const sb = await supabaseServer();
  const { data } = await sb.rpc("hub_home", { p_area: area || null, p_cat: cat || null });
  return (data ?? { areas: [], categories: [], sponsors: [], places: [] }) as HubHome;
});

export const loadPlace = cache(async (slug: string): Promise<HubPlaceFull | null> => {
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) return null;
  const sb = await supabaseServer();
  const { data } = await sb.rpc("hub_place", { p_slug: slug });
  return (data ?? null) as HubPlaceFull | null;
});

