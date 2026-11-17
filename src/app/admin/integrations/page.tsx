import { notFound } from "next/navigation";
import { requireTeam, atLeast } from "@/lib/admin";
import { aiStatus } from "@/lib/review/draft";
import { AiTest } from "@/components/admin/AiTest";
import { PageHead, Pill } from "@/components/admin/ui";

const SAMPLE = `// app/api/taprizz/route.ts   (in your OTHER project)
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // Only Taprizz may call this: it sends the shared secret.
  if (req.headers.get("authorization") !== \`Bearer \${process.env.TAPRIZZ_SECRET}\`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json();

  // body.task is "review_draft" (a guest's answers) or "review_reply" (an owner's pasted review)
  const text =
    body.task === "review_reply"
      ? await writeReply(body.business, body.review)          // your model and your rules
      : await writeDraft(body.business, body.rating, body.answers);

  return NextResponse.json({ text });                          // plain text only
}`;

export default async function IntegrationsPage() {
  const { sb, role } = await requireTeam();
  if (!atLeast(role, "manager")) notFound();
  const st = aiStatus();
  const { data: sec } = await sb.rpc("my_security_status");
  const wa = !!(sec as { whatsapp_ready?: boolean } | null)?.whatsapp_ready;
  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="flex justify-between gap-4 py-2 text-sm" style={{ borderTop: "1px solid var(--d-line)" }}><span style={{ color: "var(--d-muted)" }}>{k}</span><span style={{ color: "var(--d-text)" }}>{v}</span></div>
  );
  return (
    <>
      <PageHead title="Integrations" sub="What Taprizz is connected to, and a way to check it." />
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="d-card p-5 xl:col-span-2" aria-labelledby="ai">
          <div className="flex flex-wrap items-center gap-3"><h2 id="ai" className="font-semibold">Review writer</h2>{st.provider === "custom" ? (st.ready ? <Pill tone="green">Your own model</Pill> : <Pill tone="amber">Address missing</Pill>) : st.provider === "template" ? <Pill tone="gray">Built-in text</Pill> : <Pill tone={st.ready ? "green" : "amber"}>{st.provider}</Pill>}</div>
          <p className="mt-1 text-sm" style={{ color: "var(--d-muted)" }}>Writes the draft a guest sees and the reply an owner copies. Connect your trained model from your other project.</p>
          <div className="mt-3">
            <Row k="Writer in use" v={st.provider} />
            {st.provider === "custom" && <Row k="Your model's address" v={st.host ?? "not set"} />}
            {st.provider === "custom" && <Row k="Shared secret" v={st.hasSecret ? "set" : "not set (anyone could call your endpoint)"} />}
            {st.keySet !== null && <Row k="Provider key" v={st.keySet ? "set" : "missing"} />}
          </div>
          <div className="mt-4"><AiTest /></div>

          <details className="mt-6 text-sm" style={{ color: "var(--d-sub)" }}>
            <summary className="min-h-11 cursor-pointer py-3 font-medium" style={{ color: "var(--d-text)" }}>How to connect your other project</summary>
            <ol className="list-decimal space-y-3 pl-5">
              <li><b>In your other project</b>, add one endpoint that Taprizz can call. It receives the facts and returns <code>{`{ "text": "..." }`}</code>. Inside it you call your trained model with your own rules. Example for a Next.js project:
                <pre className="mt-2 overflow-x-auto rounded-lg p-3 text-xs" style={{ background: "var(--d-bg)", boxShadow: "inset 0 0 0 1px var(--d-line-2)" }}>{SAMPLE}</pre>
                Using n8n instead? Use a Webhook node (POST) that checks the Authorization header, runs your workflow, and a Respond to Webhook node that returns <code>{`{ "text": "..." }`}</code>.</li>
              <li><b>Make a long random secret</b> and add it to that project as <code>TAPRIZZ_SECRET</code>, then deploy it.</li>
              <li><b>In Vercel, open the eco-leads project, Settings, Environment Variables</b> and add:
                <ul className="mt-1 list-disc pl-5"><li><code>REVIEW_AI_PROVIDER</code> = <code>custom</code></li><li><code>REVIEW_AI_URL</code> = the full address, like https://your-other-project.vercel.app/api/taprizz</li><li><code>REVIEW_AI_SECRET</code> = the same secret</li></ul>
                Then redeploy eco-leads.</li>
              <li><b>Come back here and press Send a test review.</b> Green means guests and owners are now getting your model&apos;s text.</li>
              <li>If you see a 401 or 403, switch off Vercel Authentication for the production site of your other project, or give it a custom domain.</li>
            </ol>
            <p className="mt-3">The exact request and reply format is in <code>docs/REVIEW_AI.md</code> in the repository. If your model is slow or down, guests still get a built-in draft.</p>
          </details>
        </section>

        <section className="d-card p-5" aria-labelledby="g">
          <div className="flex items-center gap-3"><h2 id="g" className="font-semibold">Google reviews</h2><Pill tone="amber">Waiting for Google</Pill></div>
          <p className="mt-2 text-sm" style={{ color: "var(--d-muted)" }}>Owners paste a review and copy the reply for now. One-click replies and automatic fetching switch on after Google approves Business Profile API access.</p>
        </section>
        <section className="d-card p-5" aria-labelledby="w">
          <div className="flex items-center gap-3"><h2 id="w" className="font-semibold">WhatsApp sign-in codes</h2>{wa ? <Pill tone="green">Connected</Pill> : <Pill tone="gray">Not connected</Pill>}</div>
          <p className="mt-2 text-sm" style={{ color: "var(--d-muted)" }}>{wa ? "New devices get a code on WhatsApp." : "Until it is connected, the authenticator app is used. Setup steps are in docs/WHATSAPP_CODES.md."}</p>
        </section>
      </div>
    </>
  );
}
