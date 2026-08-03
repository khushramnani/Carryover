import type { EventKind } from "../types";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          discord_user_id: string | null;
          discord_username: string | null;
          admin_channel_id: string | null;
          guild_member_verified_at: string | null;
          required_ms: number;
          official_start: string;
          official_end: string;
          break_counts_against: boolean;
          theme: "dark" | "light";
          phrases: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          discord_user_id?: string | null;
          discord_username?: string | null;
          admin_channel_id?: string | null;
          guild_member_verified_at?: string | null;
          required_ms?: number;
          official_start?: string;
          official_end?: string;
          break_counts_against?: boolean;
          theme?: "dark" | "light";
          phrases?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          discord_user_id?: string | null;
          discord_username?: string | null;
          admin_channel_id?: string | null;
          guild_member_verified_at?: string | null;
          required_ms?: number;
          official_start?: string;
          official_end?: string;
          break_counts_against?: boolean;
          theme?: "dark" | "light";
          phrases?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          user_id: string;
          day_key: string;
          kind: EventKind;
          ts: string;
          raw: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          day_key: string;
          kind: EventKind;
          ts: string;
          raw?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          day_key?: string;
          kind?: EventKind;
          ts?: string;
          raw?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      plans: {
        Row: {
          id: string;
          user_id: string;
          day_key: string;
          preset: string;
          preset_title: string;
          cost_ms: number;
          note: string | null;
          applied: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          day_key: string;
          preset: string;
          preset_title: string;
          cost_ms: number;
          note?: string | null;
          applied?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          day_key?: string;
          preset?: string;
          preset_title?: string;
          cost_ms?: number;
          note?: string | null;
          applied?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type EventRow = Database["public"]["Tables"]["events"]["Row"];
export type PlanRow = Database["public"]["Tables"]["plans"]["Row"];
