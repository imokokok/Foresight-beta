"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, TrendingUp, Clock, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "@/lib/i18n";
import { Modal } from "@/components/ui/Modal";

interface SearchResult {
  id: number;
  title: string;
  description: string;
  category: string;
  type: "prediction" | "user" | "topic";
}

interface GlobalSearchProps {
  placeholder?: string;
  className?: string;
}

/**
 * 全局搜索组件
 *
 * 特性：
 * - 实时搜索（防抖）
 * - 快捷键支持（Cmd/Ctrl + K）
 * - 热门搜索推荐
 * - 搜索历史
 * - 分类结果展示
 *
 * @example
 * ```tsx
 * <GlobalSearch placeholder="搜索预测、话题、用户..." />
 * ```
 */
export default function GlobalSearch({ placeholder, className = "" }: GlobalSearchProps) {
  const tSearch = useTranslations("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);

  const hotKeys = ["hot.usElection", "hot.btcPrice", "hot.worldCup", "hot.ai", "hot.climate"];
  const hotSearches = hotKeys.map((key) => tSearch(key));

  // 搜索历史（从 localStorage 读取）
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
    // 读取搜索历史
    const history = localStorage.getItem("search_history");
    if (history) {
      try {
        setSearchHistory(JSON.parse(history));
      } catch {}
    }
  }, []);

  // 防抖搜索
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setLoading(false);
      setError(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results || []);
        setError(false);
      } catch (error) {
        console.error("Search failed:", error);
        setResults([]);
        setError(true);
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms 防抖

    return () => clearTimeout(timer);
  }, [query]);

  // 快捷键支持：Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // 保存搜索历史
  const saveSearchHistory = useCallback(
    (term: string) => {
      const newHistory = [term, ...searchHistory.filter((h) => h !== term)].slice(0, 5);
      setSearchHistory(newHistory);
      localStorage.setItem("search_history", JSON.stringify(newHistory));
    },
    [searchHistory]
  );

  // 执行搜索
  const handleSearch = useCallback(
    (term: string) => {
      setQuery(term);
      saveSearchHistory(term);
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [saveSearchHistory]
  );

  // 清空搜索
  const handleClear = () => {
    setQuery("");
    setResults([]);
    setError(false);
    inputRef.current?.focus();
  };

  // 分类图标
  const getCategoryIcon = (type: string) => {
    switch (type) {
      case "prediction":
        return "🎯";
      case "user":
        return "👤";
      case "topic":
        return "💡";
      default:
        return "📄";
    }
  };

  const searchModal =
    isOpen && mounted ? (
      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        ariaLabelledby="global-search-title"
        role="dialog"
        initialFocusRef={inputRef as React.RefObject<HTMLElement>}
        containerClassName="flex items-start justify-center mt-20 w-full px-4"
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100"
      >
        <AnimatePresence>
          <motion.div
            ref={containerRef}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className="relative flex items-center px-4 py-3 border-b border-gray-100">
              <Search className="w-5 h-5 text-gray-400 mr-3" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder ?? tSearch("placeholder")}
                className="flex-1 text-gray-900 placeholder-gray-400 outline-none text-base"
                autoFocus
              />
              {loading && <Loader2 className="w-5 h-5 text-purple-600 animate-spin mr-2" />}
              {query && (
                <button
                  onClick={handleClear}
                  className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label={tSearch("clearSearchAria")}
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
              <div className="ml-3 px-2 py-1 bg-gray-100 rounded text-xs text-gray-500 font-medium">
                ESC
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {results.length > 0 && (
                <div className="p-2">
                  <div className="text-xs font-medium text-gray-500 px-3 py-2">
                    {tSearch("resultsTitle")}
                  </div>
                  {results.map((result) => (
                    <Link
                      key={result.id}
                      href={`/prediction/${result.id}`}
                      onClick={() => {
                        saveSearchHistory(result.title);
                        setIsOpen(false);
                      }}
                      className="block px-3 py-3 rounded-lg hover:bg-gray-50 transition-colors group"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl mt-0.5">{getCategoryIcon(result.type)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 group-hover:text-purple-600 transition-colors mb-1 line-clamp-1">
                            {result.title}
                          </div>
                          <div className="text-xs text-gray-500 line-clamp-2">
                            {result.description}
                          </div>
                          {result.category && (
                            <div className="mt-2">
                              <span className="inline-block px-2 py-0.5 bg-purple-50 text-purple-600 text-xs rounded-full">
                                {result.category}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {query.length >= 2 && !loading && results.length === 0 && !error && (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-3">🔍</div>
                  <div className="text-gray-900 font-medium mb-2">{tSearch("emptyTitle")}</div>
                  <div className="text-sm text-gray-500">{tSearch("emptyDescription")}</div>
                </div>
              )}

              {query.length >= 2 && !loading && error && (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-3">⚠️</div>
                  <div className="text-gray-900 font-medium mb-2">{tSearch("errorTitle")}</div>
                  <div className="text-sm text-gray-500">{tSearch("errorDescription")}</div>
                </div>
              )}

              {results.length === 0 && query.length === 0 && (
                <div className="p-4">
                  {searchHistory.length > 0 && (
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-xs font-medium text-gray-500 flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          {tSearch("recentTitle")}
                        </div>
                        <button
                          onClick={() => {
                            setSearchHistory([]);
                            localStorage.removeItem("search_history");
                          }}
                          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          {tSearch("clear")}
                        </button>
                      </div>
                      <div className="space-y-1">
                        {searchHistory.map((term, index) => (
                          <button
                            key={index}
                            onClick={() => handleSearch(term)}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-sm text-gray-700 transition-colors"
                          >
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      {tSearch("hotTitle")}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {hotSearches.map((term, index) => (
                        <button
                          key={index}
                          onClick={() => handleSearch(term)}
                          className="px-3 py-1.5 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 text-gray-700 rounded-lg text-sm font-medium transition-all hover:shadow-sm"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs">
                    ↵
                  </kbd>
                  <span>{tSearch("hintConfirm")}</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs">
                    ESC
                  </kbd>
                  <span>{tSearch("hintClose")}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs">
                  ⌘K
                </kbd>
                <span>{tSearch("hintOpen")}</span>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </Modal>
    ) : null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 px-4 py-2 bg-white/80 border border-gray-200 rounded-xl hover:border-purple-300 hover:shadow-md transition-all ${className}`}
      >
        <Search className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-500">{placeholder ?? tSearch("placeholder")}</span>
        <div className="ml-auto flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-500">
          <span className="hidden sm:inline">⌘K</span>
        </div>
      </button>

      {mounted && searchModal}
    </>
  );
}
