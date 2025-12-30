import { notFound } from "next/navigation";
import ForumChatDetailClient from "./ForumChatDetailClient";
import { getClient } from "@/lib/supabase";

type Props = {
  params: Promise<{ id: string }>;
};

async function getPredictionForChat(id: string) {
  const client = getClient();
  if (!client) return null;

  const { data } = await (client as any)
    .from("predictions")
    .select("id, title, category, description, followers_count, created_at")
    .eq("id", id)
    .single();

  return data;
}

export default async function Page({ params }: Props) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  const idNum = Number(id);
  if (!Number.isFinite(idNum) || idNum <= 0) {
    notFound();
  }

  const prediction = await getPredictionForChat(id);
  if (!prediction) {
    notFound();
  }

  return <ForumChatDetailClient id={idNum} prediction={prediction} />;
}
