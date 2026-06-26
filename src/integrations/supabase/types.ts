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
      callcapture_app_settings: {
        Row: {
          bypass_billing: boolean
          id: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bypass_billing?: boolean
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bypass_billing?: boolean
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
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
      callcapture_calls: {
        Row: {
          business_id: string | null
          caller_name: string | null
          caller_phone: string | null
          client_id: string | null
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          issue_summary: string | null
          lead_id: string | null
          recording_url: string | null
          started_at: string
          status: Database["public"]["Enums"]["call_status"]
          updated_at: string
          vapi_call_id: string | null
        }
        Insert: {
          business_id?: string | null
          caller_name?: string | null
          caller_phone?: string | null
          client_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          issue_summary?: string | null
          lead_id?: string | null
          recording_url?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["call_status"]
          updated_at?: string
          vapi_call_id?: string | null
        }
        Update: {
          business_id?: string | null
          caller_name?: string | null
          caller_phone?: string | null
          client_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          issue_summary?: string | null
          lead_id?: string | null
          recording_url?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["call_status"]
          updated_at?: string
          vapi_call_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "callcapture_calls_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "callcapture_businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "callcapture_calls_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "callcapture_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "callcapture_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "callcapture_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      callcapture_clients: {
        Row: {
          address: string | null
          after_hours_message: string | null
          after_hours_mode: string
          alert_phone: string
          answer_after_hours: boolean
          assigned_callcapture_number: string | null
          business_hours_24_7: boolean
          business_hours_schedule: Json | null
          business_name: string
          business_phone: string | null
          created_at: string
          crm_connected_at: string | null
          crm_interest: string[] | null
          crm_provider: string | null
          email: string
          faqs: Json
          first_test_call_id: string | null
          forward_first: boolean
          forward_phone: string | null
          google_category: string | null
          google_place_id: string | null
          google_rating: number | null
          greeting: string | null
          human_pause: boolean
          id: string
          include_business_name: boolean
          industry: string | null
          intake_questions: Json | null
          is_super_admin: boolean | null
          launched_at: string | null
          notification_settings: Json
          number_provisioned_at: string | null
          number_status: string | null
          onboarding_completed_at: string | null
          owner_name: string
          payment_status: string
          phone_mode: string | null
          preferred_area_code: string | null
          rings_before_answer: number
          services: string[]
          setup_status: string
          setup_step: number
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
          voice_speed: string
          voicemail_fallback: boolean
          website: string | null
        }
        Insert: {
          address?: string | null
          after_hours_message?: string | null
          after_hours_mode?: string
          alert_phone: string
          answer_after_hours?: boolean
          assigned_callcapture_number?: string | null
          business_hours_24_7?: boolean
          business_hours_schedule?: Json | null
          business_name: string
          business_phone?: string | null
          created_at?: string
          crm_connected_at?: string | null
          crm_interest?: string[] | null
          crm_provider?: string | null
          email: string
          faqs?: Json
          first_test_call_id?: string | null
          forward_first?: boolean
          forward_phone?: string | null
          google_category?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          greeting?: string | null
          human_pause?: boolean
          id?: string
          include_business_name?: boolean
          industry?: string | null
          intake_questions?: Json | null
          is_super_admin?: boolean | null
          launched_at?: string | null
          notification_settings?: Json
          number_provisioned_at?: string | null
          number_status?: string | null
          onboarding_completed_at?: string | null
          owner_name: string
          payment_status?: string
          phone_mode?: string | null
          preferred_area_code?: string | null
          rings_before_answer?: number
          services?: string[]
          setup_status?: string
          setup_step?: number
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
          voice_speed?: string
          voicemail_fallback?: boolean
          website?: string | null
        }
        Update: {
          address?: string | null
          after_hours_message?: string | null
          after_hours_mode?: string
          alert_phone?: string
          answer_after_hours?: boolean
          assigned_callcapture_number?: string | null
          business_hours_24_7?: boolean
          business_hours_schedule?: Json | null
          business_name?: string
          business_phone?: string | null
          created_at?: string
          crm_connected_at?: string | null
          crm_interest?: string[] | null
          crm_provider?: string | null
          email?: string
          faqs?: Json
          first_test_call_id?: string | null
          forward_first?: boolean
          forward_phone?: string | null
          google_category?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          greeting?: string | null
          human_pause?: boolean
          id?: string
          include_business_name?: boolean
          industry?: string | null
          intake_questions?: Json | null
          is_super_admin?: boolean | null
          launched_at?: string | null
          notification_settings?: Json
          number_provisioned_at?: string | null
          number_status?: string | null
          onboarding_completed_at?: string | null
          owner_name?: string
          payment_status?: string
          phone_mode?: string | null
          preferred_area_code?: string | null
          rings_before_answer?: number
          services?: string[]
          setup_status?: string
          setup_step?: number
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
          voice_speed?: string
          voicemail_fallback?: boolean
          website?: string | null
        }
        Relationships: []
      }
      callcapture_dispatch: {
        Row: {
          call_id: string
          created_at: string
          eta_minutes: number | null
          id: string
          status: Database["public"]["Enums"]["dispatch_status"]
          technician_id: string | null
          updated_at: string
        }
        Insert: {
          call_id: string
          created_at?: string
          eta_minutes?: number | null
          id?: string
          status?: Database["public"]["Enums"]["dispatch_status"]
          technician_id?: string | null
          updated_at?: string
        }
        Update: {
          call_id?: string
          created_at?: string
          eta_minutes?: number | null
          id?: string
          status?: Database["public"]["Enums"]["dispatch_status"]
          technician_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "callcapture_dispatch_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: true
            referencedRelation: "callcapture_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "callcapture_dispatch_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "callcapture_technicians"
            referencedColumns: ["id"]
          },
        ]
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
      callcapture_sms_messages: {
        Row: {
          body: string
          call_id: string | null
          client_id: string | null
          direction: Database["public"]["Enums"]["sms_direction"]
          id: string
          lead_id: string | null
          sent_at: string
          status: string | null
          to_phone: string | null
        }
        Insert: {
          body: string
          call_id?: string | null
          client_id?: string | null
          direction?: Database["public"]["Enums"]["sms_direction"]
          id?: string
          lead_id?: string | null
          sent_at?: string
          status?: string | null
          to_phone?: string | null
        }
        Update: {
          body?: string
          call_id?: string | null
          client_id?: string | null
          direction?: Database["public"]["Enums"]["sms_direction"]
          id?: string
          lead_id?: string | null
          sent_at?: string
          status?: string | null
          to_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "callcapture_sms_messages_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "callcapture_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "callcapture_sms_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "callcapture_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "callcapture_sms_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "callcapture_leads"
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
      callcapture_technicians: {
        Row: {
          client_id: string
          created_at: string
          id: string
          name: string
          phone: string | null
          status: Database["public"]["Enums"]["technician_status"]
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          status?: Database["public"]["Enums"]["technician_status"]
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["technician_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "callcapture_technicians_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "callcapture_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      callcapture_transcript_turns: {
        Row: {
          at: string
          call_id: string
          id: string
          role: Database["public"]["Enums"]["transcript_role"]
          seq: number
          text: string
        }
        Insert: {
          at?: string
          call_id: string
          id?: string
          role: Database["public"]["Enums"]["transcript_role"]
          seq?: number
          text: string
        }
        Update: {
          at?: string
          call_id?: string
          id?: string
          role?: Database["public"]["Enums"]["transcript_role"]
          seq?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "callcapture_transcript_turns_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "callcapture_calls"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_current_user_super_admin: { Args: never; Returns: boolean }
      owns_client: { Args: { _client_id: string }; Returns: boolean }
    }
    Enums: {
      call_status:
        | "live"
        | "new"
        | "booked"
        | "transferred"
        | "completed"
        | "missed"
      dispatch_status: "assigned" | "en_route" | "arrived" | "cancelled"
      sms_direction: "outbound" | "inbound"
      technician_status: "available" | "assigned" | "en_route" | "off"
      transcript_role: "ai" | "caller"
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
    Enums: {
      call_status: [
        "live",
        "new",
        "booked",
        "transferred",
        "completed",
        "missed",
      ],
      dispatch_status: ["assigned", "en_route", "arrived", "cancelled"],
      sms_direction: ["outbound", "inbound"],
      technician_status: ["available", "assigned", "en_route", "off"],
      transcript_role: ["ai", "caller"],
    },
  },
} as const
