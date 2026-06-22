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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      callcapture_assistant_configs: {
        Row: {
          after_hours_enabled: boolean | null
          assistant_name: string | null
          business_id: string
          call_rules: Json | null
          callback_timeline: string | null
          closed_days: string[] | null
          created_at: string
          generated_prompt: string | null
          greeting: string | null
          id: string
          intake_questions: Json | null
          notification_settings: Json | null
          primary_treatments: string[] | null
          tone: string | null
          transfer_enabled: boolean | null
          transfer_phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          after_hours_enabled?: boolean | null
          assistant_name?: string | null
          business_id: string
          call_rules?: Json | null
          callback_timeline?: string | null
          closed_days?: string[] | null
          created_at?: string
          generated_prompt?: string | null
          greeting?: string | null
          id?: string
          intake_questions?: Json | null
          notification_settings?: Json | null
          primary_treatments?: string[] | null
          tone?: string | null
          transfer_enabled?: boolean | null
          transfer_phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          after_hours_enabled?: boolean | null
          assistant_name?: string | null
          business_id?: string
          call_rules?: Json | null
          callback_timeline?: string | null
          closed_days?: string[] | null
          created_at?: string
          generated_prompt?: string | null
          greeting?: string | null
          id?: string
          intake_questions?: Json | null
          notification_settings?: Json | null
          primary_treatments?: string[] | null
          tone?: string | null
          transfer_enabled?: boolean | null
          transfer_phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "callcapture_assistant_configs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "callcapture_businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      callcapture_businesses: {
        Row: {
          business_hours: string | null
          business_name: string
          created_at: string
          email: string | null
          id: string
          industry: string | null
          phone: string | null
          service_area: string | null
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_hours?: string | null
          business_name: string
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          phone?: string | null
          service_area?: string | null
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_hours?: string | null
          business_name?: string
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          phone?: string | null
          service_area?: string | null
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      callcapture_clients: {
        Row: {
          address: string | null
          alert_phone: string
          answer_after_hours: boolean
          assigned_callcapture_number: string | null
          business_hours_24_7: boolean
          business_hours_schedule: Json | null
          business_name: string
          business_phone: string | null
          created_at: string
          email: string
          forward_first: boolean
          forward_phone: string | null
          greeting: string | null
          human_pause: boolean
          id: string
          include_business_name: boolean
          industry: string | null
          intake_questions: Json | null
          is_super_admin: boolean | null
          number_provisioned_at: string | null
          number_status: string | null
          owner_name: string
          payment_status: string
          phone_mode: string | null
          preferred_area_code: string | null
          rings_before_answer: number
          setup_status: string
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          timezone: string
          tone: string
          transfer_fallback: string
          transfer_triggers: string[]
          trial_ends_at: string | null
          twilio_phone_number_sid: string | null
          updated_at: string
          user_id: string | null
          voice_id: string | null
          voice_label: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          alert_phone: string
          answer_after_hours?: boolean
          assigned_callcapture_number?: string | null
          business_hours_24_7?: boolean
          business_hours_schedule?: Json | null
          business_name: string
          business_phone?: string | null
          created_at?: string
          email: string
          forward_first?: boolean
          forward_phone?: string | null
          greeting?: string | null
          human_pause?: boolean
          id?: string
          include_business_name?: boolean
          industry?: string | null
          intake_questions?: Json | null
          is_super_admin?: boolean | null
          number_provisioned_at?: string | null
          number_status?: string | null
          owner_name: string
          payment_status?: string
          phone_mode?: string | null
          preferred_area_code?: string | null
          rings_before_answer?: number
          setup_status?: string
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          timezone?: string
          tone?: string
          transfer_fallback?: string
          transfer_triggers?: string[]
          trial_ends_at?: string | null
          twilio_phone_number_sid?: string | null
          updated_at?: string
          user_id?: string | null
          voice_id?: string | null
          voice_label?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          alert_phone?: string
          answer_after_hours?: boolean
          assigned_callcapture_number?: string | null
          business_hours_24_7?: boolean
          business_hours_schedule?: Json | null
          business_name?: string
          business_phone?: string | null
          created_at?: string
          email?: string
          forward_first?: boolean
          forward_phone?: string | null
          greeting?: string | null
          human_pause?: boolean
          id?: string
          include_business_name?: boolean
          industry?: string | null
          intake_questions?: Json | null
          is_super_admin?: boolean | null
          number_provisioned_at?: string | null
          number_status?: string | null
          owner_name?: string
          payment_status?: string
          phone_mode?: string | null
          preferred_area_code?: string | null
          rings_before_answer?: number
          setup_status?: string
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          timezone?: string
          tone?: string
          transfer_fallback?: string
          transfer_triggers?: string[]
          trial_ends_at?: string | null
          twilio_phone_number_sid?: string | null
          updated_at?: string
          user_id?: string | null
          voice_id?: string | null
          voice_label?: string | null
          website?: string | null
        }
        Relationships: []
      }
      callcapture_leads: {
        Row: {
          address: string | null
          business_id: string | null
          client_id: string | null
          created_at: string
          id: string
          intake_answers: Json | null
          issue: string | null
          name: string | null
          new_or_returning: string | null
          phone: string | null
          raw_payload: Json | null
          referral: string | null
          status: string
          summary: string | null
          timing: string | null
          transcript: string | null
          treatment: string | null
          type: string | null
          urgency: string | null
        }
        Insert: {
          address?: string | null
          business_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          intake_answers?: Json | null
          issue?: string | null
          name?: string | null
          new_or_returning?: string | null
          phone?: string | null
          raw_payload?: Json | null
          referral?: string | null
          status?: string
          summary?: string | null
          timing?: string | null
          transcript?: string | null
          treatment?: string | null
          type?: string | null
          urgency?: string | null
        }
        Update: {
          address?: string | null
          business_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          intake_answers?: Json | null
          issue?: string | null
          name?: string | null
          new_or_returning?: string | null
          phone?: string | null
          raw_payload?: Json | null
          referral?: string | null
          status?: string
          summary?: string | null
          timing?: string | null
          transcript?: string | null
          treatment?: string | null
          type?: string | null
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "callcapture_leads_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "callcapture_businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "callcapture_leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "callcapture_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      callcapture_support_requests: {
        Row: {
          business_name: string | null
          created_at: string
          email: string
          id: string
          message: string | null
          name: string
          phone: string | null
          request_type: string
          user_id: string | null
        }
        Insert: {
          business_name?: string | null
          created_at?: string
          email: string
          id?: string
          message?: string | null
          name: string
          phone?: string | null
          request_type: string
          user_id?: string | null
        }
        Update: {
          business_name?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          name?: string
          phone?: string | null
          request_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_current_user_super_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
