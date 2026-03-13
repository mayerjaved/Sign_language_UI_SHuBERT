"use client";

import { ChevronDown, Globe } from "lucide-react";
import { type SignLanguage } from "@/lib/types";

interface LanguageSelectorProps {
  languages: SignLanguage[];
  selected: SignLanguage;
  onChange: (lang: SignLanguage) => void;
}

export default function LanguageSelector({
  languages,
  selected,
  onChange,
}: LanguageSelectorProps) {
  return (
    <div className="relative inline-flex">
      <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
        <Globe className="h-4 w-4 text-[color:var(--muted)]" />
      </div>
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value as SignLanguage)}
        className="appearance-none rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] py-2 pl-9 pr-9 text-sm font-medium text-[color:var(--ink)] shadow-sm transition-all hover:border-[color:var(--border)] hover:bg-[color:var(--surface-soft)]"
      >
        {languages.map((lang) => (
          <option key={lang} value={lang} className="bg-[color:var(--surface)] text-[color:var(--ink)]">
            {lang} Interpretation
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
        <ChevronDown className="h-4 w-4 text-[color:var(--muted)]" />
      </div>
    </div>
  );
}
