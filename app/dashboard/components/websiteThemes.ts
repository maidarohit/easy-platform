export type WebsiteTheme = {
  name: string;
  pageBackground: string;
  sectionBackground: string;
  cardBackground: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  mutedTextColor: string;
  borderColor: string;
  headingFont: string;
  bodyFont: string;
  buttonRadius: string;
  cardRadius: string;
};

export const websiteThemes: Record<string, WebsiteTheme> = {
  Minimal: {
    name: "Minimal",
    pageBackground: "#ffffff",
    sectionBackground: "#f8fafc",
    cardBackground: "#ffffff",
    primaryColor: "#0f172a",
    secondaryColor: "#475569",
    textColor: "#0f172a",
    mutedTextColor: "#64748b",
    borderColor: "#e2e8f0",
    headingFont: "Arial, sans-serif",
    bodyFont: "Arial, sans-serif",
    buttonRadius: "8px",
    cardRadius: "12px",
  },

  Modern: {
    name: "Modern",
    pageBackground: "#ffffff",
    sectionBackground: "#ecfeff",
    cardBackground: "#ffffff",
    primaryColor: "#06b6d4",
    secondaryColor: "#0891b2",
    textColor: "#0f172a",
    mutedTextColor: "#475569",
    borderColor: "#a5f3fc",
    headingFont: "Arial, sans-serif",
    bodyFont: "Arial, sans-serif",
    buttonRadius: "12px",
    cardRadius: "20px",
  },

  Luxury: {
    name: "Luxury",
    pageBackground: "#0c0a09",
    sectionBackground: "#1c1917",
    cardBackground: "#292524",
    primaryColor: "#d4af37",
    secondaryColor: "#f5e6b3",
    textColor: "#fffaf0",
    mutedTextColor: "#d6d3d1",
    borderColor: "#57534e",
    headingFont: "Georgia, serif",
    bodyFont: "Arial, sans-serif",
    buttonRadius: "2px",
    cardRadius: "4px",
  },

  Corporate: {
    name: "Corporate",
    pageBackground: "#f8fafc",
    sectionBackground: "#e2e8f0",
    cardBackground: "#ffffff",
    primaryColor: "#1d4ed8",
    secondaryColor: "#1e3a8a",
    textColor: "#0f172a",
    mutedTextColor: "#475569",
    borderColor: "#cbd5e1",
    headingFont: "Arial, sans-serif",
    bodyFont: "Arial, sans-serif",
    buttonRadius: "6px",
    cardRadius: "8px",
  },

  Creative: {
    name: "Creative",
    pageBackground: "#fff7ed",
    sectionBackground: "#ffedd5",
    cardBackground: "#ffffff",
    primaryColor: "#f97316",
    secondaryColor: "#db2777",
    textColor: "#431407",
    mutedTextColor: "#78716c",
    borderColor: "#fed7aa",
    headingFont: "Georgia, serif",
    bodyFont: "Arial, sans-serif",
    buttonRadius: "999px",
    cardRadius: "28px",
  },

  Dark: {
    name: "Dark",
    pageBackground: "#020617",
    sectionBackground: "#0f172a",
    cardBackground: "#1e293b",
    primaryColor: "#22d3ee",
    secondaryColor: "#818cf8",
    textColor: "#f8fafc",
    mutedTextColor: "#94a3b8",
    borderColor: "#334155",
    headingFont: "Arial, sans-serif",
    bodyFont: "Arial, sans-serif",
    buttonRadius: "10px",
    cardRadius: "16px",
  },
};