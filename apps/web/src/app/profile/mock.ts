import { buildDiceBearUrl } from "@/lib/dicebear";

// Mock data for browsing history (in a real app this would come from local storage or API)
export const MOCK_HISTORY = [
  {
    id: "1",
    title: "Bitcoin 会在 2024 年底突破 10 万美元吗？",
    image_url: buildDiceBearUrl("Bitcoin"),
    viewed_at: "10分钟前",
    category: "科技",
  },
  {
    id: "2",
    title: "SpaceX 星舰第五次试飞能否成功回收？",
    image_url: buildDiceBearUrl("SpaceX"),
    viewed_at: "2小时前",
    category: "科技",
  },
  {
    id: "3",
    title: "2024 欧洲杯冠军预测",
    image_url: buildDiceBearUrl("Euro2024"),
    viewed_at: "昨天",
    category: "体育",
  },
] as const;
