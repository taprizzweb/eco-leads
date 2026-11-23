import { cache } from "react";
import { supabaseServer } from "@/lib/supabase/server";
import type { NearPlace } from "@/components/hub/PlaceCard";
import type { HubChainFull, HubChainTile, HubHome, HubPlaceFull } from "@/lib/hub-shared";

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


export const loadCards = cache(async (area: string, cat: string): Promise<NearPlace[]> => {
  const sb = await supabaseServer();
  const { data } = await sb.rpc("hub_cards", { p_area: area || null, p_cat: cat || null });
  return (Array.isArray(data) ? data : []) as NearPlace[];
});

export const loadChains = cache(async (area: string, cat: string): Promise<HubChainTile[]> => {
  const sb = await supabaseServer();
  const { data } = await sb.rpc("hub_chains", { p_area: area || null, p_cat: cat || null });
  return (Array.isArray(data) ? data : []) as HubChainTile[];
});

export const loadChain = cache(async (slug: string): Promise<HubChainFull | null> => {
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) return null;
  const sb = await supabaseServer();
  const { data } = await sb.rpc("hub_chain", { p_slug: slug });
  return (data ?? null) as HubChainFull | null;
});

export const loadPlaceChain = cache(async (slug: string): Promise<{ slug: string; name: string; branches: number } | null> => {
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) return null;
  const sb = await supabaseServer();
  const { data } = await sb.rpc("hub_place_chain", { p_slug: slug });
  return (data ?? null) as { slug: string; name: string; branches: number } | null;
});
