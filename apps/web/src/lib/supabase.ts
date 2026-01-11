import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type { Database };

const isServer = typeof window === "undefined";

// 从环境变量获取Supabase配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

// 创建客户端
export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient<Database>(supabaseUrl, supabaseAnonKey) : null;

// 创建服务端客户端（用于需要更高权限的操作）
// 仅在服务端创建 supabaseAdmin，避免在浏览器端因缺少服务密钥导致报错
export const supabaseAdmin =
  isServer && !!supabaseServiceRoleKey && !!supabaseUrl
    ? createClient<Database>(supabaseUrl, supabaseServiceRoleKey as string)
    : null;

// 数据库表类型定义
export type Prediction = Database["public"]["Tables"]["predictions"]["Row"] & {
  outcomes?: Database["public"]["Tables"]["prediction_outcomes"]["Row"][]; // 扩展字段，用于关联查询
};

export type Category = Database["public"]["Tables"]["categories"]["Row"];

export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  wallet_address?: string;
  created_at: string;
  updated_at: string;
}

export interface Bet {
  id: number;
  user_id: number;
  prediction_id: number;
  amount: number;
  outcome: "yes" | "no";
  created_at: string;
}

// 热门专题相关表
export type TrendingEvent = Database["public"]["Tables"]["predictions"]["Row"] & {
  image_url: string; // 确保不为 null
};

export type EventFollow = Database["public"]["Tables"]["event_follows"]["Row"];

export type UserProfile = Database["public"]["Tables"]["user_profiles"]["Row"];

export function getClient(_id?: string): SupabaseClient<Database> | null {
  // 服务端优先使用 admin 客户端，客户端使用普通客户端
  return isServer ? supabaseAdmin || supabase : supabase;
}
