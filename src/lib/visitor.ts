// Taprizz Pass: the guest's name and number, remembered on their own phone.
// The same pass works at every Taprizz place, so they are asked only once. A place only receives the details
// when the guest actually starts something there (a review, a message), never just from opening the page.
export type Visitor = { name: string; phone: string; fromPass?: boolean };
const key = (clientId: string) => `tz_visitor_${clientId}`;
const PASS = "tz_pass";

const parse = (raw: string | null): Visitor | null => {
  try {
    const v = JSON.parse(raw ?? "null");
    return v && typeof v.name === "string" && typeof v.phone === "string" ? { name: v.name, phone: v.phone } : null;
  } catch { return null; }
};

export function loadVisitor(clientId: string): Visitor | null {
  try {
    const here = parse(localStorage.getItem(key(clientId)));
    if (here) return here;
    const pass = parse(localStorage.getItem(PASS));
    return pass ? { ...pass, fromPass: true } : null;
  } catch { return null; }
}
export function saveVisitor(clientId: string, v: Visitor) {
  const clean = { name: v.name, phone: v.phone };
  try {
    localStorage.setItem(key(clientId), JSON.stringify(clean));
    localStorage.setItem(PASS, JSON.stringify(clean));
  } catch { /* private mode: they will be asked again, nothing breaks */ }
}
/** "Not you?": forget this pass on this phone. */
export function forgetPass(clientId: string) {
  try { localStorage.removeItem(PASS); localStorage.removeItem(key(clientId)); } catch { /* nothing to forget */ }
}
export const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? "";
