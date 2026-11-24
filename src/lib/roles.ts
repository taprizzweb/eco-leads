// What each person sees. The owner of a business (and Taprizz) sees everything. A manager sees everything except the plan and money pages.
// Reception works the floor: food orders, calls, chat and announcements. A waiter only sees live orders and table requests.
export type Role = "owner" | "manager" | "reception" | "waiter" | "kitchen";
export type Section = "home" | "inbox" | "reviews" | "moments" | "mypage" | "staff" | "offers" | "calls" | "tables" | "plan" | "access" | "announce" | "pos" | "pos-menu" | "pos-bills" | "pos-chat" | "pos-settings" | "pos-kitchen" | "jaipur";

const FLOOR: Section[] = ["calls", "announce", "pos", "pos-menu", "pos-bills", "pos-chat", "pos-kitchen"];
const ALLOWED: Record<Role, Section[] | "all"> = {
  owner: "all",
  manager: ["home", "inbox", "reviews", "moments", "mypage", "staff", "offers", "calls", "tables", "access", "announce", "pos", "pos-menu", "pos-bills", "pos-chat", "pos-settings", "pos-kitchen", "jaipur"],
  reception: FLOOR,
  waiter: ["calls", "pos"],
  kitchen: ["pos-kitchen"],
};
export const toRole = (v: unknown): Role => (v === "owner" || v === "manager" || v === "reception" || v === "waiter" || v === "kitchen" ? v : "waiter");
export const can = (role: Role, s: Section) => ALLOWED[role] === "all" || (ALLOWED[role] as Section[]).includes(s);
export const ROLE_LABEL: Record<Role, string> = { owner: "Owner", manager: "Manager", reception: "Reception", waiter: "Waiter", kitchen: "Kitchen" };
export const ROLE_HELP: Record<Role, string> = {
  owner: "Everything.",
  manager: "Everything except the plan.",
  reception: "Food orders, menu, bills, chat, calls and announcements.",
  waiter: "Live orders and table requests only.",
  kitchen: "Only the kitchen screen: orders to cook, on their own phone.",
};

/** The owner dashboard buttons the Taprizz team can switch off for one business. Home always shows. */
export const OWNER_BUTTONS: { key: string; label: string; help: string }[] = [
  { key: "inbox", label: "Inbox", help: "Complaints and suggestions" },
  { key: "reviews", label: "Reviews", help: "Review drafts and replies" },
  { key: "pos", label: "Food orders", help: "Live orders, menu, bills and kitchen" },
  { key: "calls", label: "Calls", help: "Call server bell requests" },
  { key: "announce", label: "Announcements", help: "Messages to guests" },
  { key: "moments", label: "Moments", help: "Guest photos and clips" },
  { key: "mypage", label: "My Page", help: "Edit the guest page" },
  { key: "minilink", label: "Mini link", help: "The Instagram bio page" },
  { key: "staff", label: "Staff report", help: "Complaints and thank-yous per person" },
  { key: "offers", label: "WhatsApp offers", help: "Ask Taprizz to send offers" },
  { key: "jaipur", label: "Gulabi", help: "Jaipur network" },
  { key: "tables", label: "Tables", help: "Table plates and QR codes" },
  { key: "access", label: "Team access", help: "Invite managers and staff" },
  { key: "plan", label: "Plan", help: "Plan and billing page" },
];
/** The hide key of a section: every Food orders screen is one button. */
export const hideKey = (s: Section): string | null => (s === "home" ? null : s.startsWith("pos") ? "pos" : s);
