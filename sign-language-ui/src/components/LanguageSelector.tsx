"use client";

import { type SignLanguage } from "@/lib/types";
import { ChevronDown, Globe } from "lucide-react";

interface LanguageSelectorProps {
    languages: SignLanguage[];
    selected: SignLanguage;
    onChange: (lang: SignLanguage) => void;
}

export default function LanguageSelector({ languages, selected, onChange }: LanguageSelectorProps) {
    return (
        <div className="relative inline-flex">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Globe className="h-4 w-4 text-slate-400" />
            </div>
            <select
                value={selected}
                onChange={(e) => onChange(e.target.value as SignLanguage)}
                className="appearance-none bg-slate-800/80 border border-slate-700/50 text-slate-200 text-sm rounded-full pl-10 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 hover:bg-slate-700/80 hover:border-slate-600 transition-all font-medium min-w-[140px] cursor-pointer shadow-sm backdrop-blur-md"
            >
                {languages.map((lang) => (
                    <option key={lang} value={lang} className="bg-slate-800 text-slate-200">
                        {lang} Interpretation
                    </option>
                ))}
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <ChevronDown className="h-4 w-4 text-slate-400" />
            </div>
        </div>
    );
}
