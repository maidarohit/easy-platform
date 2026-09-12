function parseJsonString(value: unknown) {
  let current = value;
  for (let depth = 0; depth < 4 && typeof current === "string"; depth += 1) {
    try { current = JSON.parse(current); } catch { return null; }
  }
  return current;
}

const WRAPPER_KEYS = ["response", "body", "data", "json", "result", "output", "text"] as const;

export function unwrapMarketingProviderResponse(value: unknown): Record<string, unknown> | null {
  let current = parseJsonString(value);
  for (let depth = 0; depth < 6; depth += 1) {
    if (Array.isArray(current)) {
      if (current.length !== 1) return null;
      current = parseJsonString(current[0]);
      continue;
    }
    if (!current || typeof current !== "object") return null;
    const record = current as Record<string, unknown>;
    const wrapperKey = WRAPPER_KEYS.find((key) => Object.hasOwn(record, key));
    if (wrapperKey) {
      current = parseJsonString(record[wrapperKey]);
      continue;
    }
    return record;
  }
  return null;
}
