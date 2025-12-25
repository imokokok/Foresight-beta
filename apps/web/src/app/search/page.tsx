import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Foresight 全站搜索 - 预测市场与提案快速发现",
  description:
    "通过 Foresight 全站搜索快速发现热门预测市场、社区提案与讨论内容，用关键词联通事件、治理和策略研究。",
  alternates: {
    canonical: "/search",
    languages: {
      "zh-CN": "/search",
      "en-US": "/search",
      "es-ES": "/search",
    },
  },
};

type SearchParams = {
  q?: string;
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolved = searchParams ? await searchParams : undefined;
  const query = resolved?.q?.trim() || "";

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://foresight.market";
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SearchResultsPage",
        name: "Foresight 全站搜索",
        url: baseUrl + "/search",
        description:
          "Foresight 全站搜索结果页，聚合链上预测市场、提案广场与讨论内容，帮助你快速找到相关事件和话题。",
        inLanguage: "zh-CN",
      },
    ],
  };

  return (
    <div className="min-h-[calc(100vh-64px)] w-full bg-[#f8faff] relative overflow-x-hidden font-sans p-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-black text-slate-900 mb-3">全站搜索</h1>
        <p className="text-sm text-slate-600 mb-6">
          你可以使用右上角的搜索框（⌘K）快速搜索预测市场、提案与讨论内容。当前页面用于承载外部跳转和
          SEO 描述，当你在导航栏触发搜索时，会打开全局搜索面板。
        </p>
        {query && (
          <p className="text-xs text-slate-500">
            当前 URL 中包含查询参数 <span className="font-mono">q={query}</span>
            ，你可以在顶部搜索框中再次输入以获得实时结果。
          </p>
        )}
      </div>
    </div>
  );
}
