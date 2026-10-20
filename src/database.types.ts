export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      event_members: {
        Row: {
          created_at: string
          email: string
          event_id: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          event_id: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          event_id?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_members_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          background_url: string | null
          city: string | null
          country: string | null
          created_at: string
          ends_at: string | null
          event_format: string | null
          event_staff_emails: string | null
          id: string
          judging_ends_at: string | null
          logo_url: string | null
          name: string
          owner_user_id: string | null
          program: string | null
          projects_sort: Json | null
          registration_url: string | null
          slug: string
          starts_at: string | null
          state: string | null
          status: string
          type: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          background_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          ends_at?: string | null
          event_format?: string | null
          event_staff_emails?: string | null
          id?: string
          judging_ends_at?: string | null
          logo_url?: string | null
          name: string
          owner_user_id?: string | null
          program?: string | null
          projects_sort?: Json | null
          registration_url?: string | null
          slug: string
          starts_at?: string | null
          state?: string | null
          status: string
          type?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          background_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          ends_at?: string | null
          event_format?: string | null
          event_staff_emails?: string | null
          id?: string
          judging_ends_at?: string | null
          logo_url?: string | null
          name?: string
          owner_user_id?: string | null
          program?: string | null
          projects_sort?: Json | null
          registration_url?: string | null
          slug?: string
          starts_at?: string | null
          state?: string | null
          status?: string
          type?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_event_access: {
        Row: {
          created_at: string
          event_id: string
          guest_id: string
          id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          guest_id: string
          id?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          guest_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_event_access_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_event_access_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          ai_run_count: number
          ai_run_quota: number
          created_at: string
          display_name: string
          email: string
          id: string
          password_hash: string
          password_salt: string
          updated_at: string
        }
        Insert: {
          ai_run_count?: number
          ai_run_quota?: number
          created_at?: string
          display_name?: string
          email: string
          id?: string
          password_hash: string
          password_salt: string
          updated_at?: string
        }
        Update: {
          ai_run_count?: number
          ai_run_quota?: number
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          password_hash?: string
          password_salt?: string
          updated_at?: string
        }
        Relationships: []
      }
      ignored_prize_slugs: {
        Row: {
          created_at: string
          id: string
          owner_user_id: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_user_id?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_user_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "ignored_prize_slugs_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      prize_categories: {
        Row: {
          alias_slugs: string[]
          created_at: string
          find_words: string[]
          id: string
          name: string
          owner_user_id: string | null
          short_name: string
          slug: string
          system_prompt: string
          updated_at: string
        }
        Insert: {
          alias_slugs?: string[]
          created_at?: string
          find_words?: string[]
          id?: string
          name: string
          owner_user_id?: string | null
          short_name?: string
          slug: string
          system_prompt: string
          updated_at?: string
        }
        Update: {
          alias_slugs?: string[]
          created_at?: string
          find_words?: string[]
          id?: string
          name?: string
          owner_user_id?: string | null
          short_name?: string
          slug?: string
          system_prompt?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prize_categories_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_judges: {
        Row: {
          created_at: string
          event_id: string
          id: string
          judge_avatar_url: string | null
          judge_id: string
          judge_name: string
          judge_role: string
          last_judged_at: string
          project_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          judge_avatar_url?: string | null
          judge_id: string
          judge_name: string
          judge_role?: string
          last_judged_at?: string
          project_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          judge_avatar_url?: string | null
          judge_id?: string
          judge_name?: string
          judge_role?: string
          last_judged_at?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_judges_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_judges_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_rankings: {
        Row: {
          created_at: string
          event_id: string
          id: string
          prize_category_id: string
          project_id: string
          rank: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          prize_category_id: string
          project_id: string
          rank: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          prize_category_id?: string
          project_id?: string
          rank?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_rankings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_rankings_prize_category_id_fkey"
            columns: ["prize_category_id"]
            isOneToOne: false
            referencedRelation: "prize_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_rankings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          about_the_project: string | null
          built_with: string
          commits_outside_window: boolean
          commits_outside_window_message: string | null
          created_at: string
          csv_row: Json
          description_accuracy_level:
            | Database["public"]["Enums"]["description_accuracy_level"]
            | null
          description_accuracy_message: string | null
          event_id: string
          github_url: string | null
          id: string
          is_favorite: boolean
          is_unconsidered: boolean
          judging_notes: string | null
          judging_rating: number | null
          judging_shortlist: boolean
          notes: string | null
          opt_in_prizes: string
          prize_results: Json
          process_started_at: string | null
          project_created_at: string | null
          project_processing_status_message: string | null
          project_title: string | null
          repo_content_truncated: boolean
          standardized_opt_in_prizes: string[]
          status: Database["public"]["Enums"]["project_processing_status"]
          submission_url: string | null
          submitter_email: string | null
          submitter_first_name: string | null
          submitter_last_name: string | null
          table_number: string | null
          team_size: number | null
          tech_stack: string[]
          technical_complexity:
            | Database["public"]["Enums"]["complexity_rating"]
            | null
          technical_complexity_message: string | null
          try_it_out_links: string[]
          updated_at: string
          video_demo_link: string | null
        }
        Insert: {
          about_the_project?: string | null
          built_with?: string
          commits_outside_window?: boolean
          commits_outside_window_message?: string | null
          created_at?: string
          csv_row?: Json
          description_accuracy_level?:
            | Database["public"]["Enums"]["description_accuracy_level"]
            | null
          description_accuracy_message?: string | null
          event_id: string
          github_url?: string | null
          id?: string
          is_favorite?: boolean
          is_unconsidered?: boolean
          judging_notes?: string | null
          judging_rating?: number | null
          judging_shortlist?: boolean
          notes?: string | null
          opt_in_prizes?: string
          prize_results?: Json
          process_started_at?: string | null
          project_created_at?: string | null
          project_processing_status_message?: string | null
          project_title?: string | null
          repo_content_truncated?: boolean
          standardized_opt_in_prizes?: string[]
          status?: Database["public"]["Enums"]["project_processing_status"]
          submission_url?: string | null
          submitter_email?: string | null
          submitter_first_name?: string | null
          submitter_last_name?: string | null
          table_number?: string | null
          team_size?: number | null
          tech_stack?: string[]
          technical_complexity?:
            | Database["public"]["Enums"]["complexity_rating"]
            | null
          technical_complexity_message?: string | null
          try_it_out_links?: string[]
          updated_at?: string
          video_demo_link?: string | null
        }
        Update: {
          about_the_project?: string | null
          built_with?: string
          commits_outside_window?: boolean
          commits_outside_window_message?: string | null
          created_at?: string
          csv_row?: Json
          description_accuracy_level?:
            | Database["public"]["Enums"]["description_accuracy_level"]
            | null
          description_accuracy_message?: string | null
          event_id?: string
          github_url?: string | null
          id?: string
          is_favorite?: boolean
          is_unconsidered?: boolean
          judging_notes?: string | null
          judging_rating?: number | null
          judging_shortlist?: boolean
          notes?: string | null
          opt_in_prizes?: string
          prize_results?: Json
          process_started_at?: string | null
          project_created_at?: string | null
          project_processing_status_message?: string | null
          project_title?: string | null
          repo_content_truncated?: boolean
          standardized_opt_in_prizes?: string[]
          status?: Database["public"]["Enums"]["project_processing_status"]
          submission_url?: string | null
          submitter_email?: string | null
          submitter_first_name?: string | null
          submitter_last_name?: string | null
          table_number?: string | null
          team_size?: number | null
          tech_stack?: string[]
          technical_complexity?:
            | Database["public"]["Enums"]["complexity_rating"]
            | null
          technical_complexity_message?: string | null
          try_it_out_links?: string[]
          updated_at?: string
          video_demo_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          first_name: string
          google_sub: string
          id: string
          last_login_at: string
          last_name: string
          openrouter_key_encrypted: string | null
          openrouter_key_last4: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          first_name?: string
          google_sub: string
          id?: string
          last_login_at?: string
          last_name?: string
          openrouter_key_encrypted?: string | null
          openrouter_key_last4?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          first_name?: string
          google_sub?: string
          id?: string
          last_login_at?: string
          last_name?: string
          openrouter_key_encrypted?: string | null
          openrouter_key_last4?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bench_app_role: { Args: never; Returns: string }
      bench_uid: { Args: never; Returns: string }
      can_access_event: { Args: { p_event_id: string }; Returns: boolean }
      is_event_member: { Args: { p_event_id: string }; Returns: boolean }
      can_read_prize_category: {
        Args: { p_owner_user_id: string }
        Returns: boolean
      }
      charge_guest_ai_run: { Args: { p_guest_id: string }; Returns: boolean }
    }
    Enums: {
      complexity_rating: "invalid" | "beginner" | "intermediate" | "advanced"
      description_accuracy_level: "low" | "medium" | "high"
      project_processing_status:
        | "unprocessed"
        | "processing:code_review"
        | "processing:prize_category_review"
        | "invalid:github_inaccessible"
        | "invalid:rule_violation"
        | "errored"
        | "processed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      complexity_rating: ["invalid", "beginner", "intermediate", "advanced"],
      description_accuracy_level: ["low", "medium", "high"],
      project_processing_status: [
        "unprocessed",
        "processing:code_review",
        "processing:prize_category_review",
        "invalid:github_inaccessible",
        "invalid:rule_violation",
        "errored",
        "processed",
      ],
    },
  },
} as const
