type Row = { id: string; name: string; email: string; phone: string; message: string; created_at: string };

/** Messages that visitors sent from the page's contact form (newest first). */
export function ContactList({ rows }: { rows: Row[] }) {
  return (
    <section className="d-card mb-4 p-5">
      <h2 className="font-semibold">Contact form messages ({rows.length})</h2>
      {rows.length === 0 ? <p className="mt-2 text-sm" style={{ color: "var(--d-muted)" }}>No messages yet. They appear here when someone sends the contact form.</p> : (
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl p-3 text-sm" style={{ boxShadow: "inset 0 0 0 1px var(--d-line)" }}>
              <p className="font-medium">{r.name}</p>
              <p className="mt-0.5 text-xs" style={{ color: "var(--d-muted)" }}>
                <a className="underline" href={`tel:+91${r.phone}`}>{r.phone}</a> · <a className="underline" href={`mailto:${r.email}`}>{r.email}</a> · {new Date(r.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
              </p>
              <p className="mt-1.5 whitespace-pre-wrap">{r.message}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
