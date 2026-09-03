export type PublicOrderInput = Readonly<{
  productId: string;
  quantity: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  note: string | null;
}>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9 ()-]{7,24}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_KEYS = ["slug", "productId", "quantity", "name", "email", "phone", "address", "note", "company"] as const;

function field(value: unknown, maximum: number) {
  return typeof value === "string" && value.trim().length <= maximum && !/[<>\u0000-\u001f\u007f]/u.test(value.trim())
    ? value.trim()
    : null;
}

export function validatePublicOrder(value: unknown): { valid: true; order: PublicOrderInput } | { valid: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { valid: false, error: "Please check your request." };
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !ALLOWED_KEYS.includes(key as (typeof ALLOWED_KEYS)[number])) || field(record.company, 100)) {
    return { valid: false, error: "Please check your request." };
  }
  const name = field(record.name, 160);
  const email = record.email ? field(record.email, 254) : null;
  const phone = record.phone ? field(record.phone, 32) : null;
  const address = record.address ? field(record.address, 500) : null;
  const note = record.note ? field(record.note, 2_000) : null;
  const productId = typeof record.productId === "string" && UUID.test(record.productId.trim()) ? record.productId.trim().toLowerCase() : null;
  const quantityValue = typeof record.quantity === "number" ? record.quantity : typeof record.quantity === "string" ? Number(record.quantity) : NaN;
  const quantity = Number.isInteger(quantityValue) ? quantityValue : NaN;
  if (!name || name.length < 2 || !productId || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20) {
    return { valid: false, error: "Please choose an item and provide your name." };
  }
  if ((!email && !phone) || (email && !EMAIL.test(email)) || (phone && !PHONE.test(phone))) {
    return { valid: false, error: "Please provide a valid email or phone number." };
  }
  return {
    valid: true,
    order: {
      productId,
      quantity,
      name,
      email: email ? email.toLowerCase() : null,
      phone,
      address,
      note,
    },
  };
}
