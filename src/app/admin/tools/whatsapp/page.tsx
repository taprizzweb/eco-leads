import { notFound } from "next/navigation";
import { requireTeam, atLeast } from "@/lib/admin";
import { PageHead } from "@/components/admin/ui";
import { WhatsappAdmin } from "@/components/admin/WhatsappAdmin";

export default async function WhatsappPage() {
  const { sb, role } = await requireTeam();
  if (!atLeast(role, "manager")) notFound();
  const { data: clients } = await sb.from("clients").select("id, name, slug, review_setup").order("name");
  const { data: days } = await sb.from("app_settings").select("value").eq("key", "contact_retention_days").maybeSingle();
  const api = { token: !!process.env.WHATSAPP_TOKEN, phone: !!process.env.WHATSAPP_PHONE_NUMBER_ID };
  return (
    <>
      <PageHead title="WhatsApp Automation" sub="Which businesses collect customer numbers for WhatsApp offers, and who those customers are." />
      <WhatsappAdmin clients={(clients ?? []) as never} api={api} retentionDays={Number(days?.value ?? 45)} />
    </>
  );
}
