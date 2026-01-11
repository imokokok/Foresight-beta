import { notFound } from "next/navigation";
import ForumChatDetailClient from "./ForumChatDetailClient";
import { getClient } from "@/lib/supabase";

type Props = {
  params: { id: string };
};

async function getPredictionForChat(id: number) {
  const client = getClient();
  if (!client) return null;

  const { data, error } = await client
    .from("predictions")
    .select("id, title, category, description, followers_count, created_at")
    .eq("id", id)
    .single();

  if (error) return null;
  return data;
}

export default async function Page({ params }: Props) {
  const id = params.id;
  const idNum = Number(id);
  if (!Number.isFinite(idNum) || idNum <= 0) {
    notFound();
  }

  const prediction = await getPredictionForChat(idNum);
  if (!prediction) {
    notFound();
  }

  return <ForumChatDetailClient eventId={idNum} prediction={prediction} />;
}
