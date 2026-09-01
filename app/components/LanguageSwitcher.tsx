"use client";

import { useEffect, useState } from "react";

const languages = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "zh", label: "简体中文" },
  { code: "kn", label: "ಕನ್ನಡ" },
  { code: "ta", label: "தமிழ்" },
  { code: "te", label: "తెలుగు" },
  { code: "ml", label: "മലയാളം" },
];

export function LanguageSwitcher() {
  const [language, setLanguage] = useState("en");

  useEffect(() => {
    const savedLanguage =
      localStorage.getItem("buzypeezy-language") || "en";

    setLanguage(savedLanguage);
  }, []);

  const changeLanguage = (value: string) => {
    setLanguage(value);

    localStorage.setItem(
      "buzypeezy-language",
      value
    );

    window.dispatchEvent(
      new CustomEvent("buzypeezy-language-change", {
        detail: value,
      })
    );
  };

  return (
    <select
      value={language}
      onChange={(e) => changeLanguage(e.target.value)}
      className="rounded-xl border border-white/20 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
      aria-label="Select language"
    >
      {languages.map((item) => (
        <option key={item.code} value={item.code}>
          {item.label}
        </option>
      ))}
    </select>
  );
}

export default LanguageSwitcher;