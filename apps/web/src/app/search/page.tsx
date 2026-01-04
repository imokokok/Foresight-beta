import { Metadata } from "next";
import { t } from "@/lib/i18n";
import { defaultLocale, type Locale } from "../../i18n-config";
import { getServerLocale } from "@/lib/i18n-server";
import { buildLanguageAlternates } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const title = t("market.searchPage.metaTitle", locale);
  const description = t("market.searchPage.metaDescription", locale);

  return {
    title,
    description,
    alternates: buildLanguageAlternates("/search"),
  };
}

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
  const jsonLdLocale: Locale = defaultLocale;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SearchResultsPage",
        name: t("market.searchPage.jsonLdName", jsonLdLocale),
        url: baseUrl + "/search",
        description: t("market.searchPage.jsonLdDescription", jsonLdLocale),
        inLanguage: jsonLdLocale,
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
        <h1 className="text-2xl font-black text-slate-900 mb-3">
          {t("market.searchPage.heading")}
        </h1>
        <p className="text-sm text-slate-600 mb-6">{t("market.searchPage.body")}</p>
        {query && (
          <p className="text-xs text-slate-500">
            {t("market.searchPage.queryHint").replace("{query}", query)}
          </p>
        )}
      </div>
    </div>
  );
}
