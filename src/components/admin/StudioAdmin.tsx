"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2, AlertTriangle, Search } from "lucide-react";
import Link from "next/link";
import { ClientReviewSetup } from "./ClientReviewSetup";
import { supabaseBrowser } from "@/lib/supabase/client";
import { LANGS, cleanQuestions, defaultQuestions, resolveQuestions, type Lang, type Question } from "@/lib/review/questions";
import { useToast } from "@/components/dash/Toast";
import { AiTest } from "./AiTest";
import { Pill } from "./ui";
import { QuestionsEditor, TranslateBar } from "./QuestionsEditor";

type Example = { language?: string; rating?: number; text: string };
type Settings = { rules?: string; banned?: string[]; length_min?: number; length_max?: number; examples?: Example[] };
type Cat = { id: string; label: string; keywords: string[] | null; notes: string | null; questions: unknown; sort?: number };
type Cl = { id: string; name: string; slug?: string | null; business_type: string | null; review_setup: ClientSetup | null; logo_url?: string | null; theme?: string | null };
type ClientSetup = NonNullable<Parameters<typeof ClientReviewSetup>[0]["setup"]>;
type Status = { provider: string; host: string | null; hasSecret: boolean; keySet: boolean | null; ready: boolean };
type Tab = "businesses" | "connection" | "rules" | "categories" | "playground";

const SAMPLE_RULES = `Write like a real person typing on their phone, not like a brochure.
Keep sentences short. It is fine to be a little informal.
Say how it felt in simple words, never as a list.
Do not repeat the business name more than once.
Never exaggerate. A 3-star review should sound lukewarm, not angry.`;

export function StudioAdmin({ initial, categories, clients, status }: { initial: Settings; categories: Cat[]; clients: Cl[]; status: Status }) {
  const [tab, setTab] = useState<Tab>("businesses");
  const tabs: { id: Tab; label: string }[] = [{ id: "businesses", label: "Businesses" }, { id: "connection", label: "Connection" }, { id: "rules", label: "Writing rules" }, { id: "categories", label: "Categories and questions" }, { id: "playground", label: "Playground" }];
  const aiOn = status.provider !== "template" && status.ready;
  return (
    <div className="space-y-4">
      {!aiOn && (
        <div className="d-card flex items-start gap-3 p-4" style={{ boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--d-amber) 50%, transparent)" }}>
          <AlertTriangle size={18} className="mt-0.5 shrink-0" style={{ color: "var(--d-amber)" }} />
          <p className="text-sm" style={{ color: "var(--d-text)" }}>No AI is connected yet, so guests get plain fallback text, the kind you do not want. Connect a free model first: open the <b>Connection</b> tab.</p>
        </div>
      )}
      <div className="d-seg w-fit max-w-full overflow-x-auto" role="tablist" aria-label="AI Review Studio">
        {tabs.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>
      {tab === "businesses" && <Businesses clients={clients} categories={categories} />}
      {tab === "connection" && <Connection status={status} />}
      {tab === "rules" && <Rules initial={initial} />}
      {tab === "categories" && <Categories initial={categories} />}
      {tab === "playground" && <Playground clients={clients} categories={categories} />}
    </div>
  );
}

/* ------------------------------------------------------------------ connection */
function Connection({ status }: { status: Status }) {
  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="flex justify-between gap-4 py-2 text-sm" style={{ borderTop: "1px solid var(--d-line)" }}><span style={{ color: "var(--d-muted)" }}>{k}</span><span style={{ color: "var(--d-text)" }}>{v}</span></div>;
  const code = "rounded px-1.5 py-0.5 text-[13px]";
  const codeStyle = { background: "var(--d-bg)", boxShadow: "inset 0 0 0 1px var(--d-line-2)" };
  return (
    <section className="d-card p-5">
      <div className="flex flex-wrap items-center gap-3"><h2 className="font-semibold">Which AI writes the reviews</h2>{status.provider === "template" ? <Pill tone="amber">Not connected</Pill> : <Pill tone={status.ready ? "green" : "amber"}>{status.provider}</Pill>}</div>
      <div className="mt-3">
        <Row k="Writer in use" v={status.provider === "template" ? "built-in plain text (no AI)" : status.provider} />
        {status.keySet !== null && <Row k="API key" v={status.keySet ? "set" : "missing"} />}
        {status.provider === "custom" && <Row k="Your model's address" v={status.host ?? "not set"} />}
      </div>
      <div className="mt-4"><AiTest /></div>

      <div className="mt-6 space-y-4 text-sm" style={{ color: "var(--d-sub)" }}>
        <div>
          <p className="font-medium" style={{ color: "var(--d-text)" }}>Recommended to start: Google Gemini Flash (free)</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            <li>Open <span className={code} style={codeStyle}>aistudio.google.com</span>, sign in, press <b>Get API key</b>, and copy the key.</li>
            <li>In Vercel open the <b>eco-leads</b> project, Settings, Environment Variables, and add <span className={code} style={codeStyle}>GEMINI_API_KEY</span> (the key) and <span className={code} style={codeStyle}>REVIEW_AI_PROVIDER</span> = <span className={code} style={codeStyle}>gemini</span>.</li>
            <li>Redeploy, then press <b>Send a test review</b> above and try the <b>Playground</b>.</li>
          </ol>
          <p className="mt-2" style={{ color: "var(--d-muted)" }}>It handles Hindi and Hinglish well and the free tier is generous for a start. One thing to know: on Google&apos;s free tier, prompts may be used to improve their products. We only send the guest&apos;s first name and chosen answers, never a phone number. Move to the paid tier (a few paise per review) before many clients are live.</p>
        </div>
        <div>
          <p className="font-medium" style={{ color: "var(--d-text)" }}>Other free or cheap options (any OpenAI-compatible service)</p>
          <p className="mt-1">Groq, OpenRouter or a hosted open model such as gpt-oss or Llama. Set <span className={code} style={codeStyle}>REVIEW_AI_PROVIDER</span> = <span className={code} style={codeStyle}>openai</span>, <span className={code} style={codeStyle}>OPENAI_API_KEY</span> = that service&apos;s key, <span className={code} style={codeStyle}>REVIEW_AI_BASE_URL</span> = its address (for example https://api.groq.com/openai/v1) and <span className={code} style={codeStyle}>REVIEW_AI_MODEL</span> = the model name. Paid OpenAI also works the same way with gpt-4o-mini.</p>
        </div>
        <p style={{ color: "var(--d-muted)" }}>Keys live only in Vercel, never in the database or in chat.</p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ writing rules */
function Rules({ initial }: { initial: Settings }) {
  const sb = supabaseBrowser();
  const toast = useToast();
  const [rules, setRules] = useState(initial.rules ?? "");
  const [banned, setBanned] = useState((initial.banned ?? []).join("\n"));
  const [lo, setLo] = useState(String(initial.length_min ?? 35));
  const [hi, setHi] = useState(String(initial.length_max ?? 95));
  const [ex, setEx] = useState<Example[]>(initial.examples ?? []);
  const [busy, setBusy] = useState(false);

  async function save() {
    const min = Math.max(10, Math.min(300, parseInt(lo) || 35)), max = Math.max(min, Math.min(300, parseInt(hi) || 95));
    const payload: Settings = {
      rules: rules.trim(), banned: banned.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 60), length_min: min, length_max: max,
      examples: ex.map((e) => ({ ...e, text: e.text.trim() })).filter((e) => e.text).slice(0, 12),
    };
    setBusy(true);
    const { error } = await sb.rpc("ai_studio_set", { p: payload });
    setBusy(false);
    if (error) return toast(error.message || "That did not save.", true);
    toast("Writing rules saved. New reviews use them straight away.");
  }

  return (
    <section className="d-card space-y-5 p-5">
      <div>
        <h2 className="font-semibold">How reviews should sound</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--d-muted)" }}>These rules apply to every business. They are sent to the AI with each review, so write them like instructions to a person.</p>
      </div>
      <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>House rules</span>
        <textarea className="d-input mt-1.5" rows={7} maxLength={4000} value={rules} onChange={(e) => setRules(e.target.value)} placeholder={SAMPLE_RULES} />
        {!rules.trim() && <button type="button" className="mt-1 text-xs underline underline-offset-4" style={{ color: "var(--d-muted)" }} onClick={() => setRules(SAMPLE_RULES)}>Start from a sample</button>}
      </label>
      <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>Words and phrases to never use</span><span className="ml-2 text-xs" style={{ color: "var(--d-muted)" }}>one per line</span>
        <textarea className="d-input mt-1.5" rows={4} value={banned} onChange={(e) => setBanned(e.target.value)} placeholder={"amazing experience\nvalue for money\nhighly recommended"} /></label>
      <div className="grid grid-cols-2 gap-4 sm:max-w-sm">
        <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>Shortest (words)</span><input type="number" min={10} max={300} className="d-input mt-1.5" value={lo} onChange={(e) => setLo(e.target.value)} /></label>
        <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>Longest (words)</span><input type="number" min={10} max={300} className="d-input mt-1.5" value={hi} onChange={(e) => setHi(e.target.value)} /></label>
      </div>
      <div>
        <p className="text-sm font-medium" style={{ color: "var(--d-text)" }}>Examples of reviews you like</p>
        <p className="mb-2 text-xs" style={{ color: "var(--d-muted)" }}>The AI learns the feel from these and never copies them. A few good ones in each language make the biggest difference.</p>
        <div className="space-y-3">
          {ex.map((e, i) => (
            <div key={i} className="d-raise space-y-2 p-3">
              <div className="flex gap-2">
                <select aria-label={`Language of example ${i + 1}`} className="d-input !min-h-10 !w-40" value={e.language ?? ""} onChange={(ev) => setEx(ex.map((x, k) => (k === i ? { ...x, language: ev.target.value || undefined } : x)))}>
                  <option value="">Any language</option>{LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
                <select aria-label={`Stars of example ${i + 1}`} className="d-input !min-h-10 !w-32" value={e.rating ?? ""} onChange={(ev) => setEx(ex.map((x, k) => (k === i ? { ...x, rating: ev.target.value ? Number(ev.target.value) : undefined } : x)))}>
                  <option value="">Any stars</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}
                </select>
                <button type="button" className="ml-auto grid h-10 w-10 place-items-center" aria-label={`Remove example ${i + 1}`} style={{ color: "var(--d-muted)" }} onClick={() => setEx(ex.filter((_, k) => k !== i))}><Trash2 size={16} /></button>
              </div>
              <textarea aria-label={`Example ${i + 1}`} className="d-input" rows={3} maxLength={600} value={e.text} onChange={(ev) => setEx(ex.map((x, k) => (k === i ? { ...x, text: ev.target.value } : x)))} placeholder="Paste a review that sounds exactly right" />
            </div>
          ))}
        </div>
        <button type="button" className="d-btn d-btn-s mt-3" disabled={ex.length >= 12} onClick={() => setEx([...ex, { text: "" }])}><Plus size={15} /> Add example ({ex.length} of 12)</button>
      </div>
      <p className="text-xs" style={{ color: "var(--d-muted)" }}>Built in and not changeable: the review uses only what the guest told us, never invents details, never mentions a reward, and never asks anyone to review.</p>
      <button className="d-btn d-btn-p" disabled={busy} onClick={save}>{busy && <Loader2 size={16} className="animate-spin" />} Save writing rules</button>
    </section>
  );
}

/* ------------------------------------------------------------------ categories */
function Categories({ initial }: { initial: Cat[] }) {
  const sb = supabaseBrowser();
  const toast = useToast();
  const [cats, setCats] = useState(initial);
  const [sel, setSel] = useState<string>(initial[0]?.id ?? "new");
  const cur = cats.find((c) => c.id === sel);
  const [f, setF] = useState(() => load(initial[0]));
  const [busy, setBusy] = useState(false);

  function load(c?: Cat) {
    const own = cleanQuestions(c?.questions);
    return { id: c?.id ?? "", label: c?.label ?? "", keywords: (c?.keywords ?? []).join(", "), notes: c?.notes ?? "", custom: own.length > 0, qs: own.length ? own : defaultQuestions(c?.id) };
  }
  const choose = (id: string) => { setSel(id); setF(id === "new" ? { id: "", label: "", keywords: "", notes: "", custom: true, qs: defaultQuestions(null) } : load(cats.find((c) => c.id === id))); };

  async function save() {
    const slug = (cur?.id ?? f.id).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
    if (!f.label.trim()) return toast("Give the category a name, like Cafe or Salon.", true);
    if (!slug) return toast("Give the category a short code, like pizzeria.", true);
    const qs = f.custom ? cleanQuestions(f.qs) : null;
    if (f.custom && !qs?.length) return toast("Add at least one question with chips.", true);
    const row = { label: f.label.trim(), keywords: f.keywords.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 30), notes: f.notes.trim() || null, questions: qs };
    setBusy(true);
    const { error } = cur ? await sb.from("business_templates").update(row).eq("id", cur.id) : await sb.from("business_templates").insert({ id: slug, sort: cats.length + 1, ...row });
    setBusy(false);
    if (error) return toast(/duplicate|unique/i.test(error.message) ? "That code is already used. Pick another." : "That did not save. Only managers can edit categories.", true);
    const saved: Cat = { id: cur?.id ?? slug, label: row.label, keywords: row.keywords, notes: row.notes, questions: row.questions };
    setCats((s) => (cur ? s.map((c) => (c.id === cur.id ? saved : c)) : [...s, saved]));
    setSel(saved.id);
    toast("Category saved");
  }

  return (
    <section className="d-card space-y-4 p-5">
      <div>
        <h2 className="font-semibold">Categories and their questions</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--d-muted)" }}>Each business belongs to one category. A category sets the questions guests are asked, plus words that fit that kind of place and what its guests care about. Those words and notes are not put into guest reviews: a review says only what the guest answered or typed. A single business can still override its questions on its own page.</p>
      </div>
      <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>Category</span>
        <select className="d-input mt-1.5 !w-72" value={sel} onChange={(e) => choose(e.target.value)}>{cats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}<option value="new">+ New category</option></select></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>Name</span><input className="d-input mt-1.5" value={f.label} maxLength={40} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Cafe or Restaurant" /></label>
        {!cur && <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>Short code</span><input className="d-input mt-1.5" value={f.id} maxLength={30} onChange={(e) => setF({ ...f, id: e.target.value })} placeholder="pizzeria" /></label>}
      </div>
      <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>Words that fit this kind of place</span><span className="ml-2 text-xs" style={{ color: "var(--d-muted)" }}>comma separated</span>
        <input className="d-input mt-1.5" value={f.keywords} onChange={(e) => setF({ ...f, keywords: e.target.value })} placeholder="filter coffee, cold brew, cosy, work-friendly" /></label>
      <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>What guests of this place care about</span>
        <textarea className="d-input mt-1.5" rows={3} maxLength={600} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Taste, how quickly food arrives, the vibe for working or meeting friends, cleanliness." /></label>
      <div>
        <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={f.custom} onChange={(e) => setF({ ...f, custom: e.target.checked, qs: e.target.checked && f.qs.length === 0 ? defaultQuestions(cur?.id) : f.qs })} /> Edit this category&apos;s questions</label>
        {f.custom ? <div className="mt-2 space-y-3"><TranslateBar value={f.qs} onChange={(qs) => setF({ ...f, qs })} /><QuestionsEditor value={f.qs} onChange={(qs) => setF({ ...f, qs })} /></div> : <p className="mt-1 text-sm" style={{ color: "var(--d-muted)" }}>Using the built-in questions for this category.</p>}
      </div>
      <button className="d-btn d-btn-p" disabled={busy} onClick={save}>{busy && <Loader2 size={16} className="animate-spin" />} Save category</button>
    </section>
  );
}

/* ------------------------------------------------------------------ playground */
type Out = { text: string; provider: string; similarity: number; ms: number; tries: number; words: number };

function Playground({ clients, categories }: { clients: Cl[]; categories: Cat[] }) {
  const toast = useToast();
  const [cid, setCid] = useState(clients[0]?.id ?? "");
  const [lang, setLang] = useState<Lang>("hinglish");
  const [rating, setRating] = useState(5);
  const [name, setName] = useState("Riya");
  const [extra, setExtra] = useState("");
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Out[] | null>(null);

  const cl = clients.find((c) => c.id === cid);
  const questions: Question[] = useMemo(() => {
    if (!cl) return [];
    const cat = categories.find((c) => c.id === cl.business_type);
    return resolveQuestions({ questions: cl.review_setup?.questions ?? cat?.questions, max_questions: cl.review_setup?.max_questions }, cl.business_type);
  }, [cl, categories]);

  const tog = (q: Question, c: string) => setPicked((p) => { const cur = p[q.id] ?? []; return { ...p, [q.id]: q.type === "single" ? (cur[0] === c ? [] : [c]) : cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c] }; });

  async function run() {
    if (!cid) return toast("Pick a business first.", true);
    setBusy(true); setRes(null);
    try {
      const r = await fetch("/api/admin/ai-playground", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId: cid, rating, language: lang, name, extra, count: 4, answers: questions.map((q) => ({ id: q.id, values: picked[q.id] ?? [] })) }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "The test could not run.");
      setRes(j.results);
    } catch (e) { toast((e as Error).message, true); } finally { setBusy(false); }
  }

  return (
    <section className="d-card space-y-4 p-5">
      <div>
        <h2 className="font-semibold">Playground</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--d-muted)" }}>Pick the same answers and generate four reviews. They should all sound different. Nothing here is saved or shown to guests.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block text-sm sm:col-span-2"><span className="font-medium" style={{ color: "var(--d-text)" }}>Business</span>
          <select className="d-input mt-1.5" value={cid} onChange={(e) => { setCid(e.target.value); setPicked({}); setRes(null); }}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>Language</span>
          <select className="d-input mt-1.5" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>{LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select></label>
        <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>Stars</span>
          <select className="d-input mt-1.5" value={rating} onChange={(e) => setRating(Number(e.target.value))}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>Guest first name</span><input className="d-input mt-1.5" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} /></label>
      </div>
      {questions.map((q) => (
        <fieldset key={q.id}>
          <legend className="text-sm font-medium" style={{ color: "var(--d-text)" }}>{q.label}</legend>
          {q.type === "text" ? <input className="d-input mt-1.5" aria-label={q.label} maxLength={200} value={picked[q.id]?.[0] ?? ""} onChange={(e) => setPicked({ ...picked, [q.id]: [e.target.value] })} /> : (
            <div className="mt-1.5 flex flex-wrap gap-2">
              {q.chips.map((c) => { const on = (picked[q.id] ?? []).includes(c); return <button type="button" key={c} aria-pressed={on} onClick={() => tog(q, c)} className="d-btn !min-h-9 !px-3 !text-[13px]" style={on ? { background: "var(--d-text)", color: "var(--d-bg)" } : { background: "var(--d-bg)", color: "var(--d-sub)", boxShadow: "inset 0 0 0 1px var(--d-line-2)" }}>{c}</button>; })}
            </div>
          )}
        </fieldset>
      ))}
      <label className="block text-sm"><span className="font-medium" style={{ color: "var(--d-text)" }}>Guest&apos;s own words</span><span className="ml-2 text-xs" style={{ color: "var(--d-muted)" }}>optional</span>
        <input className="d-input mt-1.5" maxLength={300} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="the staff remembered my order" /></label>
      <button className="d-btn d-btn-p" disabled={busy} onClick={run}>{busy && <Loader2 size={16} className="animate-spin" />} {busy ? "Writing four reviews" : "Generate four reviews"}</button>

      <div aria-live="polite">
        {res && (
          <div className="space-y-3">
            {res.some((r) => r.provider === "template") && <p className="text-sm" style={{ color: "var(--d-amber)" }}>These came from the plain fallback because no AI answered. Connect a model in the Connection tab.</p>}
            {res.map((r, i) => (
              <div key={i} className="d-raise p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--d-muted)" }}>
                  <Pill tone={r.provider === "template" ? "amber" : "green"}>{r.provider}</Pill><span>{r.words} words</span><span>{r.ms} ms</span>
                  <Pill tone={r.similarity >= 40 ? "red" : r.similarity >= 25 ? "amber" : "gray"}>{r.similarity}% like another review</Pill>{r.tries > 1 && <span>rewritten {r.tries - 1}x to be more different</span>}
                </div>
                <p className="text-[15px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--d-text)" }}>{r.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}


/* ------------------------------------------------------------------ businesses */
function Businesses({ clients, categories }: { clients: Cl[]; categories: Cat[] }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const list = useMemo(() => clients.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase())), [clients, q]);
  const cur = clients.find((c) => c.id === sel);
  const catLabel = (id: string | null) => categories.find((c) => c.id === id)?.label ?? "No category";
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2" style={{ color: "var(--d-muted)" }} aria-hidden />
        <input type="search" aria-label="Search businesses" className="d-input !pl-10" placeholder="Search a business by name" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((c) => (
          <button key={c.id} type="button" aria-pressed={sel === c.id} onClick={() => setSel(c.id)} className="d-card flex items-center gap-3 p-3 text-left" style={sel === c.id ? { boxShadow: "inset 0 0 0 2px var(--d-text)" } : undefined}>
            {c.logo_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={c.logo_url} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
              : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold" style={{ background: "var(--d-bg)", color: "var(--d-text)" }}>{c.name.slice(0, 1).toUpperCase()}</span>}
            <span className="min-w-0"><span className="block truncate text-sm font-medium" style={{ color: "var(--d-text)" }}>{c.name}</span><span className="block truncate text-xs" style={{ color: "var(--d-muted)" }}>{catLabel(c.business_type)}</span></span>
          </button>
        ))}
        {list.length === 0 && <p className="text-sm" style={{ color: "var(--d-muted)" }}>No business matches &ldquo;{q}&rdquo;.</p>}
      </div>
      {cur && (
        <div className="space-y-4">
          <section className="d-card flex flex-wrap items-center gap-4 p-5">
            {cur.logo_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={cur.logo_url} alt={`${cur.name} logo`} className="h-14 w-14 rounded-2xl object-cover" />
              : <span className="grid h-14 w-14 place-items-center rounded-2xl text-xl font-bold" style={{ background: "var(--d-bg)", color: "var(--d-text)" }}>{cur.name.slice(0, 1).toUpperCase()}</span>}
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">{cur.name}</h2>
              <p className="text-sm" style={{ color: "var(--d-muted)" }}>{catLabel(cur.business_type)} · colours: {cur.theme ?? "default"}</p>
            </div>
            {cur.slug && <Link className="d-btn d-btn-s" href={`/admin/clients/${cur.slug}`}>Change name, logo and colours</Link>}
          </section>
          <ClientReviewSetup key={cur.id} clientId={cur.id} clientName={cur.name} category={cur.business_type} setup={cur.review_setup ?? {}} categories={categories} />
        </div>
      )}
    </div>
  );
}
