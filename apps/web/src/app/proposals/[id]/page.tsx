import ProposalDetailClient from "./ProposalDetailClient";
import { getClient } from "@/lib/supabase";
import { normalizePositiveId, isValidPositiveId } from "@/lib/ids";
import { Metadata, ResolvingMetadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

type ThreadRow = {
  id: number;
  title: string | null;
  content: string | null;
  user_id: string | null;
  created_at: string | null;
  updated_at?: string | null;
  category?: string | null;
};

async function getProposalThread(id: string): Promise<ThreadRow | null> {
  const idNum = normalizePositiveId(id);
  if (!isValidPositiveId(idNum)) return null;

  const client = getClient();
  if (!client) return null;

  const { data, error } = await (client as any)
    .from("forum_threads")
    .select("id, title, content, user_id, created_at, updated_at, category")
    .eq("event_id", 0)
    .eq("id", idNum)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as ThreadRow;
}

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  const thread = await getProposalThread(id);

  if (!thread) {
    return {
      title: "提案未找到",
      description: "请求的提案不存在或已被删除。",
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://foresight.market";
  const title = `${thread.title || "Foresight 提案"} | Foresight 提案广场`;
  const rawDescription =
    thread.content || "Foresight 提案广场中的治理或预测市场提案讨论，用于协作设计和评估新市场。";
  const description =
    rawDescription.length > 160 ? rawDescription.slice(0, 157) + "..." : rawDescription;

  const keywords: string[] = [];
  if (thread.category) {
    keywords.push(String(thread.category));
  }
  keywords.push("提案", "治理", "预测市场", "Foresight");

  const createdTime = thread.created_at || undefined;
  const updatedTime = thread.updated_at || createdTime || undefined;

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: `${baseUrl}/proposals/${thread.id}`,
    },
    openGraph: {
      title,
      description,
      url: `${baseUrl}/proposals/${thread.id}`,
      type: "article",
      locale: "zh_CN",
      ...(createdTime ? { publishedTime: createdTime } : {}),
      ...(updatedTime ? { modifiedTime: updatedTime } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function ProposalDetailPage({ params }: Props) {
  const resolvedParams = await params;
  return <ProposalDetailClient id={resolvedParams.id} />;
}
