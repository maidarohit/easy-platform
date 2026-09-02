export const SUPPORTED_LANGUAGE_CODES = [
  "en",
  "es",
  "fr",
  "de",
  "pt",
  "ar",
  "hi",
  "ja",
  "ko",
  "zh",
  "kn",
  "ta",
  "te",
  "ml",
] as const;

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGE_CODES)[number];

const supportedLanguageCodes = new Set<string>(SUPPORTED_LANGUAGE_CODES);

export function parseSupportedLanguageCode(value: unknown): SupportedLanguageCode | null {
  return typeof value === "string" && supportedLanguageCodes.has(value)
    ? value as SupportedLanguageCode
    : null;
}

export function supportedLanguageOrEnglish(value: unknown): SupportedLanguageCode {
  return parseSupportedLanguageCode(value) ?? "en";
}
