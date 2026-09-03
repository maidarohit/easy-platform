export const BUSINESS_TYPES = [
  { value: "proprietorship", label: "Proprietorship" },
  { value: "partnership", label: "Partnership" },
  { value: "private_limited", label: "Private limited" },
  { value: "public_limited", label: "Public limited" },
  { value: "llp", label: "LLP" },
  { value: "individual", label: "Individual" },
  { value: "trust", label: "Trust" },
  { value: "society", label: "Society" },
  { value: "ngo", label: "NGO" },
  { value: "not_yet_registered", label: "Not yet registered" },
] as const;

export const BUSINESS_CATEGORIES = [
  { value: "ecommerce", subcategory: "ecommerce", label: "Ecommerce" },
  { value: "education", subcategory: "college", label: "Education" },
  { value: "healthcare", subcategory: "clinic", label: "Healthcare" },
  { value: "food", subcategory: "restaurant", label: "Food & hospitality" },
  { value: "it_and_software", subcategory: "saas", label: "IT & software" },
  { value: "services", subcategory: "consulting", label: "Professional services" },
  { value: "fashion", subcategory: "fashion", label: "Fashion" },
] as const;

export const INDIAN_STATES = [
  "ANDHRA PRADESH", "ARUNACHAL PRADESH", "ASSAM", "BIHAR", "CHHATTISGARH", "DELHI",
  "GOA", "GUJARAT", "HARYANA", "HIMACHAL PRADESH", "JAMMU AND KASHMIR", "JHARKHAND",
  "KARNATAKA", "KERALA", "MADHYA PRADESH", "MAHARASHTRA", "MANIPUR", "MEGHALAYA",
  "MIZORAM", "NAGALAND", "ODISHA", "PUNJAB", "RAJASTHAN", "SIKKIM", "TAMIL NADU",
  "TELANGANA", "TRIPURA", "UTTAR PRADESH", "UTTARAKHAND", "WEST BENGAL",
] as const;

export function isSupportedBusinessType(value: string): boolean {
  return BUSINESS_TYPES.some((item) => item.value === value);
}

export function categoryPair(value: string) {
  return BUSINESS_CATEGORIES.find((item) => item.value === value) ?? null;
}
