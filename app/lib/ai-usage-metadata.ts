import "server-only";

export const AI_USAGE_METADATA_HEADER = "x-easy-ai-usage";

const MAX_ENCODED_LENGTH = 8_192;
const MAX_DECODED_BYTES = 6_144;
const MAX_COMPONENTS = 32;
const MAX_IDENTIFIER_LENGTH = 128;
const MAX_TOKEN_COUNT = 1_000_000_000;

export type AiUsageComponent = {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export type AiUsageMetadata = {
  version: 1;
  components: AiUsageComponent[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]) {
  const keys = Object.keys(value);
  return keys.length === allowed.length && keys.every((key) => allowed.includes(key));
}

function normalizeIdentifier(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= MAX_IDENTIFIER_LENGTH
    ? normalized
    : null;
}

function isValidTokenCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_TOKEN_COUNT
  );
}

function normalizeMetadata(value: unknown): AiUsageMetadata | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["version", "components"]) ||
    value.version !== 1 ||
    !Array.isArray(value.components) ||
    value.components.length === 0 ||
    value.components.length > MAX_COMPONENTS
  ) {
    return null;
  }

  const components: AiUsageComponent[] = [];

  for (const candidate of value.components) {
    if (
      !isRecord(candidate) ||
      !hasOnlyKeys(candidate, [
        "provider",
        "model",
        "inputTokens",
        "outputTokens",
      ])
    ) {
      return null;
    }

    const provider = normalizeIdentifier(candidate.provider);
    const model = normalizeIdentifier(candidate.model);

    if (
      !provider ||
      !model ||
      !isValidTokenCount(candidate.inputTokens) ||
      !isValidTokenCount(candidate.outputTokens)
    ) {
      return null;
    }

    components.push({
      provider,
      model,
      inputTokens: candidate.inputTokens,
      outputTokens: candidate.outputTokens,
    });
  }

  return { version: 1, components };
}

export function parseAiUsageMetadata(
  headers: Headers
): AiUsageMetadata | null {
  try {
    const encoded = headers.get(AI_USAGE_METADATA_HEADER)?.trim();

    if (
      !encoded ||
      encoded.length > MAX_ENCODED_LENGTH ||
      !/^[A-Za-z0-9_-]+$/.test(encoded)
    ) {
      return null;
    }

    const decodedBytes = Buffer.from(encoded, "base64url");

    if (
      decodedBytes.length === 0 ||
      decodedBytes.length > MAX_DECODED_BYTES ||
      decodedBytes.toString("base64url") !== encoded
    ) {
      return null;
    }

    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(
      decodedBytes
    );

    return normalizeMetadata(JSON.parse(decoded));
  } catch {
    return null;
  }
}
