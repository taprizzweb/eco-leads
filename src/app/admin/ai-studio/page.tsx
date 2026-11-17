import { notFound } from "next/navigation";
import { requireTeam, atLeast } from "@/lib/admin";
import { aiStatus } from "@/lib/review/draft";
import { StudioAdmin } from "@/components/admin/StudioAdmin";
import { PageHead } from "@/components/admin/ui";

export default async function AiStudioPage() {
  const { sb, role } = await requireTeam();
  if (!atLeast(role, "manager")) notFound();
  const [{ data: settings }, { data: cats }, { data: clients }] = await Promise.all([
    sb.rpc("ai_studio_get"),
    sb.from("business_templates").select("id, label, keywords, notes, questions, sort").order("sort"),
    sb.from("clients").select("id, name, slug, business_type, review_setup, logo_url, theme").order("name"),
  ]);
  return (
    <>
      <PageHead title="AI Review Studio" sub="Teach the writer how reviews should sound, set each category's questions, and test the result." />
      <StudioAdmin initial={(settings ?? {}) as never} categories={(cats ?? []) as never} clients={(clients ?? []) as never} status={aiStatus()} />
    </>
  );
}
