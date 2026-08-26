export function safeLoginReturn(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, "https://buzypeezy.invalid");
    if (url.origin !== "https://buzypeezy.invalid" || url.pathname !== "/billing") return null;
    const plan = url.searchParams.get("plan");
    if (plan !== null && plan !== "pro" && plan !== "business") return null;
    if ([...url.searchParams.keys()].some((key) => key !== "plan" && key !== "checkout")) return null;
    return `${url.pathname}${url.search}`;
  } catch { return null; }
}
