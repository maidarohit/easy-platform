export type WebsiteSurfaceForeground = Readonly<{
  text: string;
  muted: string;
}>;

function rgba(hex: string, alpha: number) {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#0f172a";
  const value = Number.parseInt(normalized.slice(1), 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function readableTextColor(background: string) {
  const value = Number.parseInt(background.slice(1), 16);
  const luminance = (0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255)) / 255;
  return luminance > 0.58 ? "#0f172a" : "#ffffff";
}

export function resolveWebsiteSurfaceForeground(background: string): WebsiteSurfaceForeground {
  const text = readableTextColor(background);
  return {
    text,
    muted: rgba(text, text === "#ffffff" ? 0.72 : 0.68),
  };
}
