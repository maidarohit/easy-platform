import {
  categoryPair,
  INDIAN_STATES,
  isSupportedBusinessType,
} from "@/app/lib/merchant-payment-options";

const NAME_PATTERN = /^[A-Za-z0-9 ]{4,200}$/;
const DISPLAY_NAME_PATTERN = /^[A-Za-z0-9 ]{1,255}$/;
const CONTACT_NAME_PATTERN = /^[A-Za-z0-9 ]{4,255}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type MerchantOnboardValidationError = Readonly<{
  field: string;
  error: string;
}>;

export type ValidMerchantOnboardInput = Readonly<{
  legalBusinessName: string;
  customerFacingBusinessName: string;
  email: string;
  phone: string;
  contactName: string;
  businessType: string;
  category: string;
  subcategory: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  postalCode: string;
}>;

function digits(value: unknown) {
  return typeof value === "string" ? value.replace(/\D/g, "") : "";
}

function rawText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function firstRaw(body: Record<string, unknown>, keys: readonly string[]) {
  for (const key of keys) {
    const value = rawText(body[key]);
    if (value) return value;
  }
  return "";
}

export function validateMerchantOnboardPayload(
  body: unknown,
): { valid: true; value: ValidMerchantOnboardInput } | { valid: false; field: string; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { valid: false, field: "body", error: "Invalid request body." };
  }
  const record = body as Record<string, unknown>;

  const legalBusinessName = rawText(record.legalBusinessName);
  const customerFacingBusinessName = firstRaw(record, ["customerFacingBusinessName", "businessName"])
    || legalBusinessName;
  const email = rawText(record.email).slice(0, 254).toLowerCase();
  const phone = digits(record.phone);
  const contactName = rawText(record.contactName);
  const businessType = rawText(record.businessType);
  const categoryValue = firstRaw(record, ["category", "businessCategory"]);
  const category = categoryPair(categoryValue);
  const street1 = firstRaw(record, ["street1", "registeredAddress", "address"]);
  const street2Raw = firstRaw(record, ["street2", "addressLine2"]);
  const city = rawText(record.city);
  const state = rawText(record.state).toUpperCase();
  const postalCode = digits(record.postalCode ?? record.pinCode);

  if (!NAME_PATTERN.test(legalBusinessName)) {
    return {
      valid: false,
      field: "legalBusinessName",
      error: "Legal business name must be 4–200 letters, numbers and spaces only.",
    };
  }
  if (!DISPLAY_NAME_PATTERN.test(customerFacingBusinessName)) {
    return {
      valid: false,
      field: "customerFacingBusinessName",
      error: "Customer-facing business name must use letters, numbers and spaces only.",
    };
  }
  if (!CONTACT_NAME_PATTERN.test(contactName)) {
    return {
      valid: false,
      field: "contactName",
      error: "Contact name must be 4–255 letters, numbers and spaces only.",
    };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { valid: false, field: "email", error: "Enter a valid business email." };
  }
  if (phone.length < 8 || phone.length > 15) {
    return { valid: false, field: "phone", error: "Enter a valid business phone number." };
  }
  if (!isSupportedBusinessType(businessType)) {
    return { valid: false, field: "businessType", error: "Select a supported business type." };
  }
  if (!category) {
    return { valid: false, field: "category", error: "Select a supported business category." };
  }
  if (street1.length < 3 || street1.length > 100) {
    return { valid: false, field: "street1", error: "Enter a complete registered business address (max 100 characters)." };
  }
  if (street2Raw.length > 100) {
    return { valid: false, field: "street2", error: "Address line 2 must be 100 characters or fewer." };
  }
  const street2 = street2Raw || "NA";
  if (city.length < 2 || city.length > 100) {
    return { valid: false, field: "city", error: "Enter a valid city." };
  }
  if (!(INDIAN_STATES as readonly string[]).includes(state)) {
    return { valid: false, field: "state", error: "Select a supported Indian state." };
  }
  if (postalCode.length !== 6) {
    return { valid: false, field: "postalCode", error: "Enter a 6-digit PIN code." };
  }

  return {
    valid: true,
    value: {
      legalBusinessName,
      customerFacingBusinessName,
      email,
      phone,
      contactName,
      businessType,
      category: category.value,
      subcategory: category.subcategory,
      street1,
      street2,
      city,
      state,
      postalCode,
    },
  };
}

export function merchantOnboardCanRetry(account: {
  onboardingStatus: string;
  providerAccountId: string | null;
} | null): boolean {
  if (!account) return true;
  if (account.onboardingStatus === "unavailable") return false;
  return !account.providerAccountId;
}

export function buildRouteLinkedAccountBody(input: ValidMerchantOnboardInput) {
  return {
    email: input.email,
    phone: input.phone,
    type: "route" as const,
    legal_business_name: input.legalBusinessName,
    customer_facing_business_name: input.customerFacingBusinessName,
    business_type: input.businessType,
    contact_name: input.contactName,
    profile: {
      category: input.category,
      subcategory: input.subcategory,
      addresses: {
        registered: {
          street1: input.street1,
          street2: input.street2,
          city: input.city,
          state: input.state,
          postal_code: input.postalCode,
          country: "IN" as const,
        },
      },
    },
  };
}
