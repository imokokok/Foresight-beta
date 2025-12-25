import type { ThreadView } from "../useProposalDetail";

export function buildProposalJsonLd(thread: ThreadView) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://foresight.market";
  const url = `${baseUrl}/proposals/${thread.id}`;
  const title = thread.title || "Foresight 提案";
  const rawBody =
    thread.content || "Foresight 提案广场中的治理或预测市场提案讨论，用于协作设计和评估新市场。";
  const body = rawBody.length > 480 ? rawBody.slice(0, 477) + "..." : rawBody;
  const commentsCount = Array.isArray(thread.comments) ? thread.comments.length : 0;
  const createdAt = thread.created_at;
  const updatedAt = (thread as any).updated_at || createdAt;
  const json: any = {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: title,
    articleBody: body,
    datePublished: createdAt,
    ...(updatedAt ? { dateModified: updatedAt } : {}),
    url,
    mainEntityOfPage: url,
    inLanguage: "zh-CN",
    author: {
      "@type": "Person",
      name: thread.user_id ? String(thread.user_id) : "Foresight User",
    },
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/CommentAction",
      userInteractionCount: commentsCount,
    },
  };
  if (thread.category) {
    json.about = thread.category;
  }
  if (thread.created_prediction_id) {
    json.isBasedOn = `${baseUrl}/prediction/${thread.created_prediction_id}`;
  }
  return json;
}

export function buildProposalBreadcrumbJsonLd(thread: ThreadView) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://foresight.market";
  return {
    "@context": "https://schema.org",
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
        name: "提案广场",
        item: baseUrl + "/proposals",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: thread.title || "提案详情",
        item: `${baseUrl}/proposals/${thread.id}`,
      },
    ],
  };
}
