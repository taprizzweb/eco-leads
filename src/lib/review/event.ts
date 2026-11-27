// A guest who met the business at an event stall did not visit its outlet, so they are never sent to write a
// Google review for that outlet. Their words go privately to the management instead. This is about where the
// guest was, never about the star rating.
// An answer chip counts as "event stall" when it names the Flavours Unfolded event or says "stall".
const EVENT_CHIP = /flavou?rs[\s-]*unfolded|\bstall\b/i;

export const isEventChip = (value: string) => EVENT_CHIP.test(value);

/** True when any picked answer says the guest was at an event stall. */
export const isEventGuest = (answers: Iterable<readonly string[]>) => [...answers].some((values) => values.some(isEventChip));
