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
