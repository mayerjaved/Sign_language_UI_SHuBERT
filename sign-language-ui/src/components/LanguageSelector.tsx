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
        <Globe className="h-4 w-4 text-slate-400" />
      </div>
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value as SignLanguage)}
        className="appearance-none rounded-full border border-slate-200 bg-white/80 py-2 pl-9 pr-9 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-white"
      >
        {languages.map((lang) => (
          <option key={lang} value={lang} className="bg-white text-slate-700">
            {lang} Interpretation
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </div>
    </div>
  );
}
