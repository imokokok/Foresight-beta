export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      predictions: {
        Row: {
          id: number;
          title: string;
          description: string;
          category: string;
          deadline: string;
          min_stake: number;
          criteria: string;
          image_url: string | null;
          reference_url: string | null;
          status: "active" | "completed" | "cancelled";
          type: "binary" | "multi";
          outcome_count: number;
          followers_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          title: string;
          description: string;
          category: string;
          deadline: string;
          min_stake: number;
          criteria: string;
          image_url?: string | null;
          reference_url?: string | null;
          status?: "active" | "completed" | "cancelled";
          type?: "binary" | "multi";
          outcome_count?: number;
          followers_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          title?: string;
          description?: string;
          category?: string;
          deadline?: string;
          min_stake?: number;
          criteria?: string;
          image_url?: string | null;
          reference_url?: string | null;
          status?: "active" | "completed" | "cancelled";
          type?: "binary" | "multi";
          outcome_count?: number;
          followers_count?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      prediction_outcomes: {
        Row: {
          id: number;
          prediction_id: number;
          outcome_index: number;
          label: string;
          description: string | null;
          color: string | null;
          image_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          prediction_id: number;
          outcome_index: number;
          label: string;
          description?: string | null;
          color?: string | null;
          image_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          prediction_id?: number;
          outcome_index?: number;
          label?: string;
          description?: string | null;
          color?: string | null;
          image_url?: string | null;
          created_at?: string;
        };
      };
      categories: {
        Row: {
          id: number;
          name: string;
        };
        Insert: {
          id?: number;
          name: string;
        };
        Update: {
          id?: number;
          name?: string;
        };
      };
      event_follows: {
        Row: {
          id: number;
          event_id: number;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          event_id: number;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          event_id?: number;
          user_id?: string;
          created_at?: string;
        };
      };
      user_profiles: {
        Row: {
          wallet_address: string;
          username: string | null;
          email: string | null;
          is_admin: boolean;
          is_reviewer: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          wallet_address: string;
          username?: string | null;
          email?: string | null;
          is_admin?: boolean;
          is_reviewer?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          wallet_address?: string;
          username?: string | null;
          email?: string | null;
          is_admin?: boolean;
          is_reviewer?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      orders: {
        Row: {
          id: number;
          verifying_contract: string;
          chain_id: number;
          market_key: string | null;
          maker_address: string;
          maker_salt: string;
          outcome_index: number;
          is_buy: boolean;
          price: string;
          amount: string;
          remaining: string;
          expiry: string | null;
          signature: string;
          status: string;
          sequence: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          verifying_contract: string;
          chain_id: number;
          market_key?: string | null;
          maker_address: string;
          maker_salt: string;
          outcome_index: number;
          is_buy: boolean;
          price: string;
          amount: string;
          remaining: string;
          expiry?: string | null;
          signature: string;
          status?: string;
          sequence?: number;
          created_at?: string;
        };
        Update: {
          id?: number;
          verifying_contract?: string;
          chain_id?: number;
          market_key?: string | null;
          maker_address?: string;
          maker_salt?: string;
          outcome_index?: number;
          is_buy?: boolean;
          price?: string;
          amount?: string;
          remaining?: string;
          expiry?: string | null;
          signature?: string;
          status?: string;
          sequence?: number;
          created_at?: string;
        };
      };
      markets_map: {
        Row: {
          event_id: number;
          chain_id: number;
          market: string;
          collateral_token: string | null;
          tick_size: number | null;
          resolution_time: string | null;
          status: string | null;
          outcome_count: number | null;
          outcomes: Json | null;
          created_at: string;
        };
        Insert: {
          event_id: number;
          chain_id: number;
          market: string;
          collateral_token?: string | null;
          tick_size?: number | null;
          resolution_time?: string | null;
          status?: string | null;
          outcome_count?: number | null;
          outcomes?: Json | null;
          created_at?: string;
        };
        Update: {
          event_id?: number;
          chain_id?: number;
          market?: string;
          collateral_token?: string | null;
          tick_size?: number | null;
          resolution_time?: string | null;
          status?: string | null;
          outcome_count?: number | null;
          outcomes?: Json | null;
          created_at?: string;
        };
      };
      forum_threads: {
        Row: {
          id: number;
          event_id: number;
          title: string;
          content: string | null;
          user_id: string;
          created_at: string;
          upvotes: number;
          downvotes: number;
          review_status: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_reason: string | null;
        };
        Insert: {
          id?: number;
          event_id: number;
          title: string;
          content?: string | null;
          user_id: string;
          created_at?: string;
          upvotes?: number;
          downvotes?: number;
          review_status?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_reason?: string | null;
        };
        Update: {
          id?: number;
          event_id?: number;
          title?: string;
          content?: string | null;
          user_id?: string;
          created_at?: string;
          upvotes?: number;
          downvotes?: number;
          review_status?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_reason?: string | null;
        };
      };
      forum_comments: {
        Row: {
          id: number;
          thread_id: number;
          event_id: number;
          user_id: string;
          content: string;
          created_at: string;
          upvotes: number;
          downvotes: number;
          parent_id: number | null;
        };
        Insert: {
          id?: number;
          thread_id: number;
          event_id: number;
          user_id: string;
          content: string;
          created_at?: string;
          upvotes?: number;
          downvotes?: number;
          parent_id?: number | null;
        };
        Update: {
          id?: number;
          thread_id?: number;
          event_id?: number;
          user_id?: string;
          content?: string;
          created_at?: string;
          upvotes?: number;
          downvotes?: number;
          parent_id?: number | null;
        };
      };
      forum_votes: {
        Row: {
          id: number;
          user_id: string;
          event_id: number;
          content_id: number;
          content_type: "thread" | "comment";
          vote_type: "up" | "down";
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          event_id: number;
          content_id: number;
          content_type: "thread" | "comment";
          vote_type: "up" | "down";
          created_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          event_id?: number;
          content_id?: number;
          content_type?: "thread" | "comment";
          vote_type?: "up" | "down";
          created_at?: string;
        };
      };
      discussions: {
        Row: {
          id: number;
          proposal_id: number;
          user_id: string;
          content: string;
          image_url: string | null;
          topic: string | null;
          reply_to_id: number | null;
          reply_to_user: string | null;
          reply_to_content: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          proposal_id: number;
          user_id: string;
          content: string;
          image_url?: string | null;
          topic?: string | null;
          reply_to_id?: number | null;
          reply_to_user?: string | null;
          reply_to_content?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          proposal_id?: number;
          user_id?: string;
          content?: string;
          image_url?: string | null;
          topic?: string | null;
          reply_to_id?: number | null;
          reply_to_user?: string | null;
          reply_to_content?: string | null;
          created_at?: string;
        };
      };
      notifications: {
        Row: {
          id: number;
          recipient_id: string;
          type: string;
          title: string;
          message: string;
          url: string | null;
          payload: Json;
          actor_id: string | null;
          dedupe_key: string | null;
          read_at: string | null;
          archived_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          recipient_id: string;
          type: string;
          title?: string;
          message?: string;
          url?: string | null;
          payload?: Json;
          actor_id?: string | null;
          dedupe_key?: string | null;
          read_at?: string | null;
          archived_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          recipient_id?: string;
          type?: string;
          title?: string;
          message?: string;
          url?: string | null;
          payload?: Json;
          actor_id?: string | null;
          dedupe_key?: string | null;
          read_at?: string | null;
          archived_at?: string | null;
          created_at?: string;
        };
      };
      flags: {
        Row: {
          id: number;
          user_id: string;
          title: string;
          description: string | null;
          deadline: string;
          verification_type: "self" | "witness";
          status: "active" | "pending_review" | "success" | "failed";
          proof_comment: string | null;
          proof_image_url: string | null;
          witness_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          title: string;
          description?: string | null;
          deadline: string;
          verification_type: "self" | "witness";
          status?: "active" | "pending_review" | "success" | "failed";
          proof_comment?: string | null;
          proof_image_url?: string | null;
          witness_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          title?: string;
          description?: string | null;
          deadline?: string;
          verification_type?: "self" | "witness";
          status?: "active" | "pending_review" | "success" | "failed";
          proof_comment?: string | null;
          proof_image_url?: string | null;
          witness_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      flag_checkins: {
        Row: {
          id: number;
          flag_id: number;
          user_id: string;
          note: string | null;
          image_url: string | null;
          created_at: string;
          review_status: "pending" | "approved" | "rejected" | null;
          reviewer_id: string | null;
          review_reason: string | null;
          reviewed_at: string | null;
        };
        Insert: {
          id?: number;
          flag_id: number;
          user_id: string;
          note?: string | null;
          image_url?: string | null;
          created_at?: string;
          review_status?: "pending" | "approved" | "rejected" | null;
          reviewer_id?: string | null;
          review_reason?: string | null;
          reviewed_at?: string | null;
        };
        Update: {
          id?: number;
          flag_id?: number;
          user_id?: string;
          note?: string | null;
          image_url?: string | null;
          created_at?: string;
          review_status?: "pending" | "approved" | "rejected" | null;
          reviewer_id?: string | null;
          review_reason?: string | null;
          reviewed_at?: string | null;
        };
      };
      flag_settlements: {
        Row: {
          id: number;
          flag_id: number;
          status: "success" | "failed";
          strategy: string | null;
          metrics: Json | null;
          settled_by: string | null;
          settled_at: string;
        };
        Insert: {
          id?: number;
          flag_id: number;
          status: "success" | "failed";
          strategy?: string | null;
          metrics?: Json | null;
          settled_by?: string | null;
          settled_at?: string;
        };
        Update: {
          id?: number;
          flag_id?: number;
          status?: "success" | "failed";
          strategy?: string | null;
          metrics?: Json | null;
          settled_by?: string | null;
          settled_at?: string;
        };
      };
      event_views: {
        Row: {
          id: number;
          user_id: string;
          event_id: number;
          viewed_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          event_id: number;
          viewed_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          event_id?: number;
          viewed_at?: string;
        };
      };
    };
    Views: {
      [_: string]: {
        Row: Record<string, unknown>;
      };
    };
    Functions: {
      [_: string]: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
    };
    Enums: {
      [_: string]: unknown;
    };
  };
}
