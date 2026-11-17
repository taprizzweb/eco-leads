import Link from "next/link";
import { loadOverview, daysFrom } from "@/lib/admin-data";
import { A, Empty, Expiry, PageHead, Pill, Row, TableWrap, td, th } from "@/components/admin/ui";

export default async function Clients() {
  const { clients, stats, pk } = await loadOverview();
  return (
    <>
      <PageHead title="Clients" sub={`${clients.length} in total.`}>
        <Link href="/admin/clients/new" className="d-btn d-btn-p">Add client</Link>
      </PageHead>
      {clients.length === 0 ? (
        <Empty title="No clients yet">Add a client with a name, business type and Google review link. Their page is ready straight away.</Empty>
      ) : (
        <TableWrap>
          <thead>
            <tr style={{ color: "var(--d-muted)" }}>
              <th className={th}>Client</th><th className={th}>Plan</th><th className={th}>Expiry</th><th className={th}>Status</th>
              <th className={th}>Plates</th><th className={th}>Taps (30d)</th><th className={th}>Complaints</th><th className={th}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const s = stats.get(c.id);
              return (
                <Row key={c.id}>
                  <td className={td}><A href={`/admin/clients/${c.slug}`}>{c.name}</A><div className="text-xs" style={{ color: "var(--d-muted)" }}>/{c.slug}</div></td>
                  <td className={td}>{pk.get(c.package_id)?.name ?? c.package_id}{Object.keys(c.feature_overrides ?? {}).length > 0 && <span className="ml-1.5"><Pill tone="blue">custom</Pill></span>}</td>
                  <td className={td}><Expiry iso={c.expires_at} days={daysFrom(c.expires_at)} /></td>
                  <td className={td}>{c.status === "active" ? <Pill tone="green">Active</Pill> : <Pill tone="red">Paused</Pill>}</td>
                  <td className={`${td} tabular-nums`}>{s?.plates ?? 0}</td>
                  <td className={`${td} tabular-nums`}>{s?.taps_30d ?? 0}</td>
                  <td className={`${td} tabular-nums`}>{s?.open_complaints ? <span style={{ color: s.late_complaints ? "var(--d-red)" : undefined }}>{s.open_complaints}</span> : 0}</td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    <Link href={`/dashboard/${c.slug}`} className="d-btn d-btn-s mr-2 !min-h-10 !px-4 !text-[13px]">View as client</Link>
                    <Link href={`/admin/clients/${c.slug}`} className="d-btn d-btn-s !min-h-10 !px-4 !text-[13px]">Manage</Link>
                  </td>
                </Row>
              );
            })}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
