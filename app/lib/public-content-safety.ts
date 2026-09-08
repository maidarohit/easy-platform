const UNSUPPORTED_PUBLIC_CLAIM = /(?:\b(?:free\s*trial|start\s+(?:a\s+)?free\s*trial|freemium|real\s+results?|proven\s+results?|guaranteed?(?:\s+(?:results?|leads?|rankings?))?|rank(?:ed|ing)?\s*#?\s*1|case\s+stud(?:y|ies)|placeholders?|lorem\s+ipsum)\b|(?:[$\u20b9\u20ac\u00a3]\s*(?:[xX]\b|\d))|\bTBD\b|\b(?:free|growth|pro)\s+plans?\b|\btestimonials?\b|\b(?:award(?:ed|s)?|certif(?:ied|ication|ications))\b|\b\d+(?:\.\d+)?\s*(?:x|\u00d7)\s+(?:leads?|revenue|sales|traffic|visitors?|conversions?|growth)\b|\b\d+(?:\.\d+)?\s*%|\b\d[\d,]*(?:\.\d+)?\+?\s+(?:customers?|clients?|projects?|years?|leads?|visitors?|conversions?|sales|rankings?)\b)/i;

export function hasUnsupportedPublicClaim(value: string | null | undefined) {
  return Boolean(value && UNSUPPORTED_PUBLIC_CLAIM.test(value));
}
