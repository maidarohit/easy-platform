export const PUBLIC_CONTACT_FIELDS = ["email", "phone", "whatsapp", "instagram", "facebook", "linkedin", "website", "location"] as const;
export type PublicContactField = typeof PUBLIC_CONTACT_FIELDS[number];
export type PublicContactSettings = Partial<Record<PublicContactField, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[1-9]\d{6,14}$/;
const SOCIAL_HOSTS: Readonly<Record<string, readonly string[]>> = {
  instagram: ["instagram.com", "www.instagram.com"], facebook: ["facebook.com", "www.facebook.com"],
  linkedin: ["linkedin.com", "www.linkedin.com"],
};

function safeText(value: unknown, maximum: number) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maximum && !/[<>\u0000-\u001f\u007f]/u.test(normalized) ? normalized : null;
}
function normalizedUrl(value: unknown, hosts?: readonly string[]) {
  const text = safeText(value, 500); if (!text) return null;
  try { const url = new URL(text); return url.protocol === "https:" && (!hosts || hosts.includes(url.hostname.toLowerCase())) ? url.toString() : null; }
  catch { return null; }
}
export function validatePublicContactSettings(value: unknown): { valid: true; settings: PublicContactSettings } | { valid: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { valid: false, error: "Contact settings are not valid." };
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !PUBLIC_CONTACT_FIELDS.includes(key as PublicContactField))) return { valid: false, error: "An unsupported contact method was submitted." };
  const settings: PublicContactSettings = {};
  for (const field of PUBLIC_CONTACT_FIELDS) {
    if (!Object.hasOwn(record, field) || record[field] === "") continue;
    let checked: string | null = null;
    if (field === "email") { const text = safeText(record[field], 254); checked = text && EMAIL.test(text) ? text.toLowerCase() : null; }
    else if (field === "phone" || field === "whatsapp") { const text = safeText(record[field], 32)?.replace(/[\s().-]/g, "") ?? null; checked = text && PHONE.test(text) ? text : null; }
    else if (field in SOCIAL_HOSTS) checked = normalizedUrl(record[field], SOCIAL_HOSTS[field]);
    else if (field === "website") checked = normalizedUrl(record[field]);
    else checked = safeText(record[field], 240);
    if (!checked) return { valid: false, error: `${field.charAt(0).toUpperCase() + field.slice(1)} is not valid.` };
    settings[field] = checked;
  }
  return { valid: true, settings };
}

export function publicContactMethods(settings: PublicContactSettings) {
  return [
    settings.email && { label: "Email", value: settings.email, href: `mailto:${settings.email}` },
    settings.phone && { label: "Call", value: settings.phone, href: `tel:${settings.phone}` },
    settings.whatsapp && { label: "WhatsApp", value: settings.whatsapp, href: `https://wa.me/${settings.whatsapp.replace(/\D/g, "")}` },
    settings.instagram && { label: "Instagram", value: "View profile", href: settings.instagram },
    settings.facebook && { label: "Facebook", value: "View profile", href: settings.facebook },
    settings.linkedin && { label: "LinkedIn", value: "View profile", href: settings.linkedin },
    settings.website && { label: "Website", value: "Visit website", href: settings.website },
  ].filter((item): item is { label: string; value: string; href: string } => Boolean(item));
}
