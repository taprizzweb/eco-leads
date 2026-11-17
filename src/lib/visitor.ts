// The guest's name and number, remembered on their own phone so they are asked only once per business.
export type Visitor = { name: string; phone: string };
const key = (clientId: string) => `tz_visitor_${clientId}`;

export function loadVisitor(clientId: string): Visitor | null {
  try {
    const v = JSON.parse(localStorage.getItem(key(clientId)) ?? "null");
    return v && typeof v.name === "string" && typeof v.phone === "string" ? v : null;
  } catch { return null; }
}
export function saveVisitor(clientId: string, v: Visitor) {
  try { localStorage.setItem(key(clientId), JSON.stringify(v)); } catch { /* private mode: they will be asked again, nothing breaks */ }
}
export const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? "";
