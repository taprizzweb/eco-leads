"use client";

import { useRef, useState } from "react";
import { ImagePlus, Plus, Sparkles, Star, Trash2, X } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { toWebp } from "@/lib/image";
import { useToast } from "@/components/dash/Toast";
import { inr, type MenuCat, type MenuItem } from "@/lib/pos";

const SAMPLE: { cat: string; items: [string, number, boolean, string][] }[] = [
  { cat: "Coffee", items: [["Cappuccino", 160, true, "Rich espresso with silky steamed milk"], ["Cold Coffee", 180, true, "Blended with ice cream, thick and chilled"], ["Americano", 130, true, "Bold and clean"]] },
  { cat: "Snacks", items: [["Veg Sandwich", 140, true, "Grilled with fresh veggies and cheese"], ["Chicken Wrap", 190, false, "Juicy chicken, crunchy salad, mint mayo"], ["French Fries", 120, true, "Crisp, salted, with dip"]] },
  { cat: "Desserts", items: [["Brownie with Ice Cream", 170, true, "Warm brownie, vanilla scoop, chocolate sauce"], ["Cheesecake Slice", 190, true, "Baked, creamy, berry topping"]] },
];

export function MenuManager({ clientId, initialCats, initialItems }: { clientId: string; initialCats: MenuCat[]; initialItems: MenuItem[] }) {
  const sb = supabaseBrowser();
  const toast = useToast();
  const [cats, setCats] = useState(initialCats);
  const [items, setItems] = useState(initialItems);
  const [edit, setEdit] = useState<MenuItem | "new" | null>(null);
  const [newCat, setNewCat] = useState("");
  const [filter, setFilter] = useState<string>("all");

  async function addCat() {
    const name = newCat.trim(); if (!name) return;
    const { data, error } = await sb.from("menu_categories").insert({ client_id: clientId, name, sort: cats.length }).select("id, name, sort, active").single();
    if (error || !data) return toast("That did not save. Please try again.", true);
    setCats((s) => [...s, data as MenuCat]); setNewCat("");
  }
  async function renameCat(c: MenuCat) {
    const name = window.prompt("Category name", c.name)?.trim(); if (!name || name === c.name) return;
    const { error } = await sb.from("menu_categories").update({ name }).eq("id", c.id);
    if (error) return toast("That did not save. Please try again.", true);
    setCats((s) => s.map((x) => (x.id === c.id ? { ...x, name } : x)));
  }
  async function delCat(c: MenuCat) {
    if (!window.confirm(`Delete the category "${c.name}"? Its items stay, without a category.`)) return;
    const { error } = await sb.from("menu_categories").delete().eq("id", c.id);
    if (error) return toast("That did not delete. Please try again.", true);
    setCats((s) => s.filter((x) => x.id !== c.id)); setItems((s) => s.map((i) => (i.category_id === c.id ? { ...i, category_id: null } : i)));
  }
  async function toggle(i: MenuItem, field: "available" | "bestseller") {
    const v = !i[field];
    setItems((s) => s.map((x) => (x.id === i.id ? { ...x, [field]: v } : x)));
    const { error } = await sb.from("menu_items").update({ [field]: v }).eq("id", i.id);
    if (error) { setItems((s) => s.map((x) => (x.id === i.id ? { ...x, [field]: !v } : x))); toast("That did not save. Please try again.", true); }
  }
  async function delItem(i: MenuItem) {
    if (!window.confirm(`Delete "${i.name}" from the menu?`)) return;
    const { error } = await sb.from("menu_items").delete().eq("id", i.id);
    if (error) return toast("That did not delete. Please try again.", true);
    setItems((s) => s.filter((x) => x.id !== i.id));
  }
  async function loadSample() {
    for (const [ci, g] of SAMPLE.entries()) {
      const { data: c, error } = await sb.from("menu_categories").insert({ client_id: clientId, name: g.cat, sort: cats.length + ci }).select("id, name, sort, active").single();
      if (error || !c) return toast("That did not save. Please try again.", true);
      setCats((s) => [...s, c as MenuCat]);
      const rows = g.items.map(([name, price, veg, description], n) => ({ client_id: clientId, category_id: c.id, name, price, veg, description, sort: n }));
      const { data: ins, error: e2 } = await sb.from("menu_items").insert(rows).select("id, category_id, name, description, price, veg, image_url, available, bestseller, addons, sort");
      if (e2) return toast("That did not save. Please try again.", true);
      setItems((s) => [...s, ...((ins ?? []) as unknown as MenuItem[])]);
    }
    toast("Sample menu added. Edit the names, prices and photos.");
  }

  const shown = items.filter((i) => filter === "all" || (filter === "none" ? !i.category_id : i.category_id === filter));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="d-btn d-btn-p" onClick={() => setEdit("new")}><Plus size={15} /> Add item</button>
        {items.length === 0 && <button type="button" className="d-btn d-btn-s" onClick={loadSample}><Sparkles size={15} /> Start with a sample menu</button>}
      </div>

      <section aria-label="Categories" className="d-card p-3.5">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="d-btn d-btn-s" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All ({items.length})</button>
          {cats.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1">
              <button type="button" className="d-btn d-btn-s" aria-pressed={filter === c.id} onClick={() => setFilter(c.id)} onDoubleClick={() => renameCat(c)}>{c.name} ({items.filter((i) => i.category_id === c.id).length})</button>
              {filter === c.id && <><button type="button" className="d-btn d-btn-s !px-2" onClick={() => renameCat(c)} aria-label={`Rename ${c.name}`}>Rename</button><button type="button" className="d-btn d-btn-s !px-2" onClick={() => delCat(c)} aria-label={`Delete ${c.name}`}><Trash2 size={14} /></button></>}
            </span>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input aria-label="New category" placeholder="New category, like Starters" className="d-input" value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCat()} />
          <button type="button" className="d-btn d-btn-s shrink-0" onClick={addCat}><Plus size={14} /> Add</button>
        </div>
      </section>

      {shown.length === 0 ? (
        <div className="d-card px-6 py-12 text-center text-sm" style={{ color: "var(--d-muted)" }}>{items.length === 0 ? "Your menu is empty. Add your first item or start with the sample." : "No items in this category."}</div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((i) => (
            <li key={i.id} className="d-card flex gap-3 p-3" style={{ opacity: i.available ? 1 : 0.6 }}>
              {i.image_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={i.image_url} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
                : <span className="grid h-20 w-20 shrink-0 place-items-center rounded-lg text-2xl" style={{ background: "var(--d-bg)" }}>🍽️</span>}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-semibold"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: i.veg ? "#16a34a" : "#dc2626" }} /><span className="truncate">{i.name}</span>{i.bestseller && <Star size={13} className="shrink-0 fill-amber-400 text-amber-400" />}</p>
                <p className="text-sm">{inr(i.price)}{i.addons.length ? <span style={{ color: "var(--d-muted)" }}> · {i.addons.length} add-on{i.addons.length > 1 ? "s" : ""}</span> : null}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button type="button" className="d-btn d-btn-s" onClick={() => setEdit(i)}>Edit</button>
                  <button type="button" className="d-btn d-btn-s" aria-pressed={i.available} onClick={() => toggle(i, "available")}>{i.available ? "In stock" : "Sold out"}</button>
                  <button type="button" className="d-btn d-btn-s" aria-pressed={i.bestseller} onClick={() => toggle(i, "bestseller")}>Bestseller</button>
                  <button type="button" className="d-btn d-btn-s !px-2" onClick={() => delItem(i)} aria-label={`Delete ${i.name}`}><Trash2 size={14} /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {edit && <ItemForm key={edit === "new" ? "new" : edit.id} clientId={clientId} cats={cats} item={edit === "new" ? null : edit} onClose={() => setEdit(null)}
        onSaved={(it) => { setItems((s) => (s.some((x) => x.id === it.id) ? s.map((x) => (x.id === it.id ? it : x)) : [...s, it])); setEdit(null); toast("Saved"); }} />}
    </div>
  );
}

function ItemForm({ clientId, cats, item, onClose, onSaved }: { clientId: string; cats: MenuCat[]; item: MenuItem | null; onClose: () => void; onSaved: (i: MenuItem) => void }) {
  const sb = supabaseBrowser();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(item?.name ?? "");
  const [price, setPrice] = useState(item ? String(item.price) : "");
  const [desc, setDesc] = useState(item?.description ?? "");
  const [cat, setCat] = useState(item?.category_id ?? cats[0]?.id ?? "");
  const [veg, setVeg] = useState(item?.veg ?? true);
  const [img, setImg] = useState(item?.image_url ?? "");
  const [addons, setAddons] = useState<{ name: string; price: string }[]>((item?.addons ?? []).map((a) => ({ name: a.name, price: String(a.price) })));
  const [busy, setBusy] = useState(false);

  async function pick(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    try {
      const blob = await toWebp(f, 900);
      const path = `${clientId}/menu/${crypto.randomUUID()}.webp`;
      const { error } = await sb.storage.from("page-assets").upload(path, blob, { contentType: "image/webp" });
      if (error) throw error;
      setImg(sb.storage.from("page-assets").getPublicUrl(path).data.publicUrl);
    } catch { toast("The photo did not upload. Please try a smaller one.", true); }
    setBusy(false);
  }
  async function save() {
    const p = Number(price);
    if (!name.trim()) return toast("Add the item name", true);
    if (price === "" || !(p >= 0)) return toast("Add a price", true);
    setBusy(true);
    const row = { client_id: clientId, name: name.trim(), price: p, description: desc.trim() || null, category_id: cat || null, veg, image_url: img || null,
      addons: addons.filter((a) => a.name.trim()).map((a) => ({ name: a.name.trim(), price: Math.max(0, Number(a.price) || 0) })) };
    const q = item ? sb.from("menu_items").update(row).eq("id", item.id) : sb.from("menu_items").insert({ ...row, sort: 999 });
    const { data, error } = await q.select("id, category_id, name, description, price, veg, image_url, available, bestseller, addons, sort").single();
    setBusy(false);
    if (error || !data) return toast("That did not save. Please try again.", true);
    onSaved(data as unknown as MenuItem);
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={item ? "Edit item" : "Add item"}>
      <div className="d-card max-h-[94dvh] w-full max-w-lg overflow-y-auto p-4 sm:p-5" style={{ background: "var(--d-bg)" }}>
        <div className="flex items-center"><h2 className="text-lg font-semibold">{item ? "Edit item" : "Add item"}</h2><button type="button" className="d-btn d-btn-s ml-auto" onClick={onClose} aria-label="Close"><X size={16} /></button></div>
        <div className="mt-3 flex items-center gap-3">
          {img
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={img} alt="" className="h-20 w-20 rounded-lg object-cover" />
            : <span className="grid h-20 w-20 place-items-center rounded-lg" style={{ background: "var(--d-surface)" }}><ImagePlus size={22} /></span>}
          <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          <button type="button" className="d-btn d-btn-s" disabled={busy} onClick={() => file.current?.click()}>{img ? "Change photo" : "Add photo"}</button>
          {img && <button type="button" className="d-btn d-btn-s" onClick={() => setImg("")}>Remove</button>}
        </div>
        <label className="mt-3 block text-sm">Name<input className="d-input mt-1" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block text-sm">Price (₹)<input className="d-input mt-1" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
          <label className="block text-sm">Category<select className="d-input mt-1" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">None</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        </div>
        <label className="mt-3 block text-sm">Short description<textarea className="d-input mt-1" rows={2} maxLength={300} value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
        <div className="d-seg mt-3" role="group" aria-label="Veg or non veg"><button type="button" aria-pressed={veg} onClick={() => setVeg(true)}>Veg</button><button type="button" aria-pressed={!veg} onClick={() => setVeg(false)}>Non veg</button></div>
        <h3 className="mt-4 mb-1.5 text-sm font-semibold" style={{ color: "var(--d-muted)" }}>Add-ons guests can pick (extra cheese, large size...)</h3>
        {addons.map((a, i) => (
          <div key={i} className="mb-2 flex items-center gap-2">
            <input aria-label="Add-on name" className="d-input flex-1" value={a.name} onChange={(e) => setAddons((s) => s.map((x, n) => (n === i ? { ...x, name: e.target.value } : x)))} />
            <input aria-label="Add-on price" inputMode="decimal" className="d-input w-24" value={a.price} onChange={(e) => setAddons((s) => s.map((x, n) => (n === i ? { ...x, price: e.target.value } : x)))} />
            <button type="button" className="d-btn d-btn-s !px-2" onClick={() => setAddons((s) => s.filter((_, n) => n !== i))} aria-label="Remove add-on"><Trash2 size={14} /></button>
          </div>
        ))}
        <button type="button" className="d-btn d-btn-s" onClick={() => setAddons((s) => [...s, { name: "", price: "" }])}><Plus size={14} /> Add-on</button>
        <button type="button" className="d-btn d-btn-p mt-5 w-full" disabled={busy} onClick={save}>Save item</button>
      </div>
    </div>
  );
}
