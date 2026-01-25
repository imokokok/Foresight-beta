import Link from "next/link";
import { languageFlags } from "@/i18n-config";

interface LanguageSwitcherProps {
  currentPath?: string;
}

export function LanguageSwitcher({ currentPath }: LanguageSwitcherProps) {
  const languages = [
    { code: "en", name: "English", flag: languageFlags.en },
    { code: "zh-CN", name: "中文", flag: languageFlags["zh-CN"] },
    { code: "es", name: "Español", flag: languageFlags.es },
    { code: "fr", name: "Français", flag: languageFlags.fr },
    { code: "ko", name: "한국어", flag: languageFlags.ko },
  ];

  return (
    <div className="flex items-center gap-2 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-white/10">
      <span className="text-sm font-medium text-gray-300">🌐 Select Language / 选择语言:</span>
      <div className="flex flex-wrap gap-2">
        {languages.map((lang) => {
          const langPath =
            lang.code === "en"
              ? currentPath?.replace(/\.zh-CN\.md$|\.es\.md$|\.fr\.md$|\.ko\.md$/, ".md") ||
                currentPath
              : currentPath?.replace(/\.md$/, `.${lang.code}.md`) ||
                `${currentPath}.${lang.code}.md`;

          return (
            <Link
              key={lang.code}
              href={langPath || "/"}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white/5 hover:bg-white/10 rounded-md transition-all duration-200 hover:scale-105 border border-white/5 hover:border-white/20"
            >
              <span>{lang.flag}</span>
              <span className="text-gray-200">{lang.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default LanguageSwitcher;
