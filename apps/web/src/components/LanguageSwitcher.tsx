"use client";

import { useState, useRef, useEffect } from "react";
import { Globe } from "lucide-react";

const languages = [
  { code: "zh-CN", name: "简体中文", flag: "🇨🇳" },
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "es", name: "Español", flag: "🇪🇸" },
] as const;

export default function LanguageSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState<string>("zh-CN");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 从 localStorage 读取语言偏好
    const savedLang = localStorage.getItem("preferred-language");
    if (savedLang && languages.some((l) => l.code === savedLang)) {
      setCurrentLang(savedLang);
    }

    // 点击外部关闭菜单
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const changeLanguage = (langCode: string) => {
    setCurrentLang(langCode);
    setIsOpen(false);

    localStorage.setItem("preferred-language", langCode);

    window.dispatchEvent(new CustomEvent("languagechange", { detail: { locale: langCode } }));
  };

  const currentLanguage = languages.find((l) => l.code === currentLang) || languages[0];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl hover:bg-white transition-colors text-sm font-medium text-gray-700"
        aria-label="切换语言"
      >
        <Globe className="w-4 h-4" />
        <span>{currentLanguage.flag}</span>
        <span className="hidden sm:inline">{currentLanguage.name}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-sm ${
                currentLang === lang.code ? "bg-purple-50 text-purple-700" : "text-gray-700"
              }`}
            >
              <span className="text-lg">{lang.flag}</span>
              <span className="font-medium">{lang.name}</span>
              {currentLang === lang.code && <span className="ml-auto text-purple-600">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
