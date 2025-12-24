import PredictionDetailClient from "./PredictionDetailClient";
import { getClient } from "@/lib/supabase";
import { Metadata, ResolvingMetadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

async function getPrediction(id: string) {
  const client = getClient();
  if (!client) return null;

  const { data } = await (client as any).from("predictions").select("*").eq("id", id).single();

  return data;
}

function buildPredictionJsonLd(id: string, prediction: any, relatedProposalId: number | null) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://foresight.market";
  const url = `${baseUrl}/prediction/${id}`;
  const title = prediction.title || "Foresight 预测市场事件";
  const rawDescription =
    prediction.description ||
    prediction.criteria ||
    "链上预测市场事件，参与交易观点，基于区块链的去中心化预测市场平台。";
  const description =
    rawDescription.length > 240 ? rawDescription.slice(0, 237) + "..." : rawDescription;
  const imageUrl = prediction.image_url || baseUrl + "/og-image.png";
  const createdTime = (prediction.created_at as string | undefined) || undefined;
  const deadline = (prediction.deadline as string | undefined) || undefined;
  const status = String(prediction.status || "active");
  const eventStatus =
    status === "resolved"
      ? "https://schema.org/EventCompleted"
      : "https://schema.org/EventScheduled";

  const event: any = {
    "@type": "Event",
    name: title,
    description,
    url,
    image: imageUrl,
    inLanguage: "zh-CN",
    eventStatus,
    ...(createdTime ? { startDate: createdTime } : {}),
    ...(deadline ? { endDate: deadline } : {}),
  };

  if (prediction.category) {
    event.about = prediction.category;
  }

  if (relatedProposalId) {
    event.isBasedOn = `${baseUrl}/proposals/${relatedProposalId}`;
  }

  return {
    "@context": "https://schema.org",
    "@graph": [
      event,
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "首页",
            item: baseUrl + "/",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "热门预测",
            item: baseUrl + "/trending",
          },
          {
            "@type": "ListItem",
            position: 3,
            name: title,
            item: url,
          },
        ],
      },
    ],
  };
}

async function getRelatedProposalId(predictionId: number): Promise<number | null> {
  const client = getClient();
  if (!client) return null;

  const { data, error } = await (client as any)
    .from("forum_threads")
    .select("id, created_prediction_id")
    .eq("event_id", 0)
    .eq("created_prediction_id", predictionId)
    .limit(1);

  if (error || !data || !data[0]) {
    return null;
  }

  const row = data[0] as any;
  const id = Number(row.id);
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }

  return id;
}

export async function generateMetadata(
  { params, searchParams }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  const prediction = await getPrediction(id);

  if (!prediction) {
    return {
      title: "Prediction Not Found",
      description: "The requested prediction market event could not be found.",
    };
  }

  const previousImages = (await parent).openGraph?.images || [];
  const imageUrl = prediction.image_url || "/og-image.png";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://foresight.market";
  const title = prediction.title || "Foresight 预测市场事件";
  const rawDescription =
    prediction.description ||
    prediction.criteria ||
    "链上预测市场事件，参与交易观点，基于区块链的去中心化预测市场平台。";
  const description =
    rawDescription.length > 160 ? rawDescription.slice(0, 157) + "..." : rawDescription;
  const keywords: string[] = [];

  if (prediction.category) {
    keywords.push(String(prediction.category));
  }

  keywords.push("预测市场", "prediction market", "区块链", "加密货币", "Foresight");

  const createdTime = (prediction.created_at as string | undefined) || undefined;
  const updatedTime = (prediction.updated_at as string | undefined) || createdTime || undefined;
  const deadline = (prediction.deadline as string | undefined) || undefined;

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: `${baseUrl}/prediction/${id}`,
    },
    openGraph: {
      title,
      description,
      url: `${baseUrl}/prediction/${id}`,
      images: [imageUrl, ...previousImages],
      type: "article",
      locale: "zh_CN",
      ...(createdTime ? { publishedTime: createdTime } : {}),
      ...(updatedTime ? { modifiedTime: updatedTime } : {}),
      ...(deadline ? { expirationTime: deadline } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function Page({ params }: Props) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  const prediction = await getPrediction(id);
  let relatedProposalId: number | null = null;

  const idNum = Number(id);
  if (Number.isFinite(idNum) && idNum > 0) {
    relatedProposalId = await getRelatedProposalId(idNum);
  }

  const jsonLd = prediction ? buildPredictionJsonLd(id, prediction, relatedProposalId) : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <PredictionDetailClient relatedProposalId={relatedProposalId} />
    </>
  );
}
