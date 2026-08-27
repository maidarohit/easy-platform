export type PublicInquiryInput = Readonly<{ name: string; email: string; phone: string | null; service: string | null; message: string }>;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9 ()-]{7,24}$/;
function field(value: unknown, maximum: number) { return typeof value === "string" && value.trim().length <= maximum && !/[<>\u0000-\u001f\u007f]/u.test(value.trim()) ? value.trim() : null; }
export function validatePublicInquiry(value: unknown): { valid: true; inquiry: PublicInquiryInput } | { valid: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { valid: false, error: "Please check your enquiry." };
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !["slug", "name", "email", "phone", "service", "message", "company"].includes(key)) || field(record.company, 100)) return { valid: false, error: "Please check your enquiry." };
  const name = field(record.name, 120); const email = field(record.email, 254); const message = field(record.message, 2_000);
  const phone = record.phone ? field(record.phone, 32) : null; const service = record.service ? field(record.service, 160) : null;
  if (!name || name.length < 2 || !email || !EMAIL.test(email) || !message || message.length < 10 || (phone && !PHONE.test(phone))) return { valid: false, error: "Please provide a valid name, email and message." };
  return { valid: true, inquiry: { name, email: email.toLowerCase(), phone, service, message } };
}
