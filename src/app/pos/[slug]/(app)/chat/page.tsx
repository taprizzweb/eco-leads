import { loadClient } from "@/lib/dash";
import { ChatInbox } from "@/components/pos/ChatInbox";

export default async function ChatPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { sb, client } = await loadClient(slug);
  const { data } = await sb.from("chat_threads").select("id, table_label, customer_name, customer_phone, unread_staff, last_message_at").eq("client_id", client.id).gte("last_message_at", new Date(Date.now() - 3 * 86400e3).toISOString()).order("last_message_at", { ascending: false }).limit(60);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.04em]">Chat</h1>
        <p className="mt-1" style={{ color: "var(--d-muted)" }}>Guests write from the menu page. Reply here and they see it at once. Or tap Reply on WhatsApp to continue on their WhatsApp number.</p>
      </div>
      <ChatInbox clientId={client.id} initial={(data ?? []) as never} />
    </div>
  );
}
