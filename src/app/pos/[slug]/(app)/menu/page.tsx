import { requireSection } from "@/lib/dash";
import { MenuManager } from "@/components/pos/MenuManager";
import type { MenuCat, MenuItem } from "@/lib/pos";

export default async function MenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { sb, client } = await requireSection(slug, "pos-menu");
  const [c, i] = await Promise.all([
    sb.from("menu_categories").select("id, name, sort, active").eq("client_id", client.id).order("sort").limit(100),
    sb.from("menu_items").select("id, category_id, name, description, price, veg, image_url, available, bestseller, addons, sort").eq("client_id", client.id).order("sort").limit(1000),
  ]);
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.04em]">Menu</h1>
        <p className="mt-1" style={{ color: "var(--d-muted)" }}>What guests see when they tap View menu. Mark an item Sold out and it is greyed out for guests straight away.</p>
      </div>
      <MenuManager clientId={client.id} initialCats={(c.data ?? []) as MenuCat[]} initialItems={(i.data ?? []) as unknown as MenuItem[]} />
    </div>
  );
}
