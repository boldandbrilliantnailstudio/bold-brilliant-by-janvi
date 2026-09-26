// Shared helpers for custom set requests (Shop > Custom Sets and Admin > Custom Requests).

// Studio reply window, India time (IST). Mon-Sat 10 AM - 8 PM; Sunday is by appointment.
const OPEN_HOUR = 10;
const CLOSE_HOUR = 20;
const IST_OFFSET_MS = 330 * 60 * 1000;

// Message shown right after a customer sends a request, so they know when to expect a reply
// even if nobody is online at the studio.
export function replyPromise(now: Date = new Date()): string {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const day = ist.getUTCDay(); // 0 = Sunday
  const hour = ist.getUTCHours();
  if (day !== 0 && hour >= OPEN_HOUR && hour < CLOSE_HOUR) {
    return "Our manager will contact you on WhatsApp within 2-4 hours.";
  }
  const when = day === 0 || (day === 6 && hour >= CLOSE_HOUR) ? "on Monday" : hour < OPEN_HOUR ? "today" : "tomorrow";
  return `The studio is closed right now. Our manager will contact you on WhatsApp ${when} after 10 AM.`;
}

// Customer number as WhatsApp needs it: digits only, with India code if they typed 10 digits.
export function waNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "").replace(/^0+/, "");
  return digits.length === 10 ? `91${digits}` : digits;
}
