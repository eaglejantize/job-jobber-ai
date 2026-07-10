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
      callcapture_appointments: {
        Row: {
          calendar_event_id: string | null
          calendar_event_link: string | null
          calendar_provider: string | null
          client_id: string
          created_at: string
          customer_address: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          end_at: string
          id: string
          lead_id: string | null
          notes: string | null
          service: string | null
          start_at: string
          status: string
          updated_at: string
        }
        Insert: {
          calendar_event_id?: string | null
          calendar_event_link?: string | null
          calendar_provider?: string | null
          client_id: string
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          end_at: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          service?: string | null
          start_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          calendar_event_id?: string | null
          calendar_event_link?: string | null
          calendar_provider?: string | null
          client_id?: string
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          end_at?: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          service?: string | null
          start_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "callcapture_appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "callcapture_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "callcapture_appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "callcapture_leads"
            referencedColumns: ["id"]
          },
        ]
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
          is_test: boolean
          issue_summary: string | null
          lead_id: string | null
          metadata: Json | null
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
          is_test?: boolean
          issue_summary?: string | null
          lead_id?: string | null
          metadata?: Json | null
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
          is_test?: boolean
          issue_summary?: string | null
          lead_id?: string | null
          metadata?: Json | null
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
          ai_personality: string | null
          alert_phone: string
          answer_after_hours: boolean
          assigned_callcapture_number: string | null
          brands_serviced: string[] | null
          business_category_group: string | null
          business_email: string | null
          business_hours: Json | null
          business_hours_24_7: boolean
          business_hours_schedule: Json | null
          business_name: string
          business_phone: string | null
          call_recording_enabled: boolean | null
          call_summary_enabled: boolean | null
          company_policies: string | null
          concierge_state: Json | null
          conversation_style: string | null
          created_at: string
          crm_connected_at: string | null
          crm_interest: string[] | null
          crm_provider: string | null
          default_job_duration_minutes: number | null
          diagnostic_fee: number | null
          email: string
          emergency_rules: Json | null
          emergency_services: boolean | null
          faqs: Json
          first_test_call_id: string | null
          forward_first: boolean
          forward_phone: string | null
          forwarding_from_number: string | null
          google_calendar_connected_at: string | null
          google_calendar_id: string | null
          google_category: string | null
          google_oauth_access_token: string | null
          google_oauth_email: string | null
          google_oauth_expires_at: string | null
          google_oauth_refresh_token: string | null
          google_oauth_scope: string | null
          google_place_id: string | null
          google_rating: number | null
          greeting: string | null
          holiday_hours: Json | null
          human_pause: boolean
          id: string
          include_business_name: boolean
          industry: string | null
          industry_workflow: Json | null
          intake_questions: Json | null
          is_super_admin: boolean | null
          knowledge_base: string | null
          language: string | null
          last_vapi_sync_at: string | null
          last_vapi_sync_status: string | null
          launched_at: string | null
          notification_settings: Json
          number_provisioned_at: string | null
          number_status: string | null
          number_test_expires_at: string | null
          onboarding_completed_at: string | null
          onboarding_state: Json | null
          owner_email: string | null
          owner_name: string
          payment_status: string
          phone_mode: string | null
          preferred_area_code: string | null
          rings_before_answer: number
          scheduling_enabled: boolean | null
          scheduling_mode: string | null
          selected_voice_catalog_id: string | null
          servanahq_enabled: boolean
          servanahq_tenant_id: string | null
          service_area: Json | null
          service_area_notes: string | null
          services: string[]
          setup_status: string
          setup_step: number
          sms_followup_enabled: boolean | null
          sms_followup_template: string | null
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          test_call_passed_at: string | null
          timezone: string
          tone: string
          transfer_fallback: string
          transfer_number: string | null
          transfer_triggers: string[]
          trial_ends_at: string | null
          twilio_phone_number_sid: string | null
          updated_at: string
          user_id: string | null
          vapi_assistant_id: string | null
          vapi_phone_number_id: string | null
          voice_id: string | null
          voice_label: string | null
          voice_provider: string | null
          voice_provider_agent_id: string | null
          voice_provider_voice_id: string | null
          voice_speed: string
          voicemail_enabled: boolean | null
          voicemail_fallback: boolean
          warranty_terms: string | null
          webhook_secret: string | null
          webhook_status: string | null
          webhook_urls: Json | null
          website: string | null
        }
        Insert: {
          address?: string | null
          after_hours_message?: string | null
          after_hours_mode?: string
          ai_personality?: string | null
          alert_phone: string
          answer_after_hours?: boolean
          assigned_callcapture_number?: string | null
          brands_serviced?: string[] | null
          business_category_group?: string | null
          business_email?: string | null
          business_hours?: Json | null
          business_hours_24_7?: boolean
          business_hours_schedule?: Json | null
          business_name: string
          business_phone?: string | null
          call_recording_enabled?: boolean | null
          call_summary_enabled?: boolean | null
          company_policies?: string | null
          concierge_state?: Json | null
          conversation_style?: string | null
          created_at?: string
          crm_connected_at?: string | null
          crm_interest?: string[] | null
          crm_provider?: string | null
          default_job_duration_minutes?: number | null
          diagnostic_fee?: number | null
          email: string
          emergency_rules?: Json | null
          emergency_services?: boolean | null
          faqs?: Json
          first_test_call_id?: string | null
          forward_first?: boolean
          forward_phone?: string | null
          forwarding_from_number?: string | null
          google_calendar_connected_at?: string | null
          google_calendar_id?: string | null
          google_category?: string | null
          google_oauth_access_token?: string | null
          google_oauth_email?: string | null
          google_oauth_expires_at?: string | null
          google_oauth_refresh_token?: string | null
          google_oauth_scope?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          greeting?: string | null
          holiday_hours?: Json | null
          human_pause?: boolean
          id?: string
          include_business_name?: boolean
          industry?: string | null
          industry_workflow?: Json | null
          intake_questions?: Json | null
          is_super_admin?: boolean | null
          knowledge_base?: string | null
          language?: string | null
          last_vapi_sync_at?: string | null
          last_vapi_sync_status?: string | null
          launched_at?: string | null
          notification_settings?: Json
          number_provisioned_at?: string | null
          number_status?: string | null
          number_test_expires_at?: string | null
          onboarding_completed_at?: string | null
          onboarding_state?: Json | null
          owner_email?: string | null
          owner_name: string
          payment_status?: string
          phone_mode?: string | null
          preferred_area_code?: string | null
          rings_before_answer?: number
          scheduling_enabled?: boolean | null
          scheduling_mode?: string | null
          selected_voice_catalog_id?: string | null
          servanahq_enabled?: boolean
          servanahq_tenant_id?: string | null
          service_area?: Json | null
          service_area_notes?: string | null
          services?: string[]
          setup_status?: string
          setup_step?: number
          sms_followup_enabled?: boolean | null
          sms_followup_template?: string | null
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          test_call_passed_at?: string | null
          timezone?: string
          tone?: string
          transfer_fallback?: string
          transfer_number?: string | null
          transfer_triggers?: string[]
          trial_ends_at?: string | null
          twilio_phone_number_sid?: string | null
          updated_at?: string
          user_id?: string | null
          vapi_assistant_id?: string | null
          vapi_phone_number_id?: string | null
          voice_id?: string | null
          voice_label?: string | null
          voice_provider?: string | null
          voice_provider_agent_id?: string | null
          voice_provider_voice_id?: string | null
          voice_speed?: string
          voicemail_enabled?: boolean | null
          voicemail_fallback?: boolean
          warranty_terms?: string | null
          webhook_secret?: string | null
          webhook_status?: string | null
          webhook_urls?: Json | null
          website?: string | null
        }
        Update: {
          address?: string | null
          after_hours_message?: string | null
          after_hours_mode?: string
          ai_personality?: string | null
          alert_phone?: string
          answer_after_hours?: boolean
          assigned_callcapture_number?: string | null
          brands_serviced?: string[] | null
          business_category_group?: string | null
          business_email?: string | null
          business_hours?: Json | null
          business_hours_24_7?: boolean
          business_hours_schedule?: Json | null
          business_name?: string
          business_phone?: string | null
          call_recording_enabled?: boolean | null
          call_summary_enabled?: boolean | null
          company_policies?: string | null
          concierge_state?: Json | null
          conversation_style?: string | null
          created_at?: string
          crm_connected_at?: string | null
          crm_interest?: string[] | null
          crm_provider?: string | null
          default_job_duration_minutes?: number | null
          diagnostic_fee?: number | null
          email?: string
          emergency_rules?: Json | null
          emergency_services?: boolean | null
          faqs?: Json
          first_test_call_id?: string | null
          forward_first?: boolean
          forward_phone?: string | null
          forwarding_from_number?: string | null
          google_calendar_connected_at?: string | null
          google_calendar_id?: string | null
          google_category?: string | null
          google_oauth_access_token?: string | null
          google_oauth_email?: string | null
          google_oauth_expires_at?: string | null
          google_oauth_refresh_token?: string | null
          google_oauth_scope?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          greeting?: string | null
          holiday_hours?: Json | null
          human_pause?: boolean
          id?: string
          include_business_name?: boolean
          industry?: string | null
          industry_workflow?: Json | null
          intake_questions?: Json | null
          is_super_admin?: boolean | null
          knowledge_base?: string | null
          language?: string | null
          last_vapi_sync_at?: string | null
          last_vapi_sync_status?: string | null
          launched_at?: string | null
          notification_settings?: Json
          number_provisioned_at?: string | null
          number_status?: string | null
          number_test_expires_at?: string | null
          onboarding_completed_at?: string | null
          onboarding_state?: Json | null
          owner_email?: string | null
          owner_name?: string
          payment_status?: string
          phone_mode?: string | null
          preferred_area_code?: string | null
          rings_before_answer?: number
          scheduling_enabled?: boolean | null
          scheduling_mode?: string | null
          selected_voice_catalog_id?: string | null
          servanahq_enabled?: boolean
          servanahq_tenant_id?: string | null
          service_area?: Json | null
          service_area_notes?: string | null
          services?: string[]
          setup_status?: string
          setup_step?: number
          sms_followup_enabled?: boolean | null
          sms_followup_template?: string | null
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          test_call_passed_at?: string | null
          timezone?: string
          tone?: string
          transfer_fallback?: string
          transfer_number?: string | null
          transfer_triggers?: string[]
          trial_ends_at?: string | null
          twilio_phone_number_sid?: string | null
          updated_at?: string
          user_id?: string | null
          vapi_assistant_id?: string | null
          vapi_phone_number_id?: string | null
          voice_id?: string | null
          voice_label?: string | null
          voice_provider?: string | null
          voice_provider_agent_id?: string | null
          voice_provider_voice_id?: string | null
          voice_speed?: string
          voicemail_enabled?: boolean | null
          voicemail_fallback?: boolean
          warranty_terms?: string | null
          webhook_secret?: string | null
          webhook_status?: string | null
          webhook_urls?: Json | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "callcapture_clients_selected_voice_catalog_id_fkey"
            columns: ["selected_voice_catalog_id"]
            isOneToOne: false
            referencedRelation: "callcapture_voice_catalog"
            referencedColumns: ["id"]
          },
        ]
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
          appointment_id: string | null
          booking_status: string | null
          business_id: string | null
          client_id: string | null
          created_at: string
          email: string | null
          id: string
          intake_answers: Json | null
          issue: string | null
          name: string | null
          new_or_returning: string | null
          phone: string | null
          raw_payload: Json | null
          referral: string | null
          servanahq_lead_id: string | null
          servanahq_sync_error: string | null
          servanahq_sync_status: string | null
          servanahq_synced_at: string | null
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
          appointment_id?: string | null
          booking_status?: string | null
          business_id?: string | null
          client_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          intake_answers?: Json | null
          issue?: string | null
          name?: string | null
          new_or_returning?: string | null
          phone?: string | null
          raw_payload?: Json | null
          referral?: string | null
          servanahq_lead_id?: string | null
          servanahq_sync_error?: string | null
          servanahq_sync_status?: string | null
          servanahq_synced_at?: string | null
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
          appointment_id?: string | null
          booking_status?: string | null
          business_id?: string | null
          client_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          intake_answers?: Json | null
          issue?: string | null
          name?: string | null
          new_or_returning?: string | null
          phone?: string | null
          raw_payload?: Json | null
          referral?: string | null
          servanahq_lead_id?: string | null
          servanahq_sync_error?: string | null
          servanahq_sync_status?: string | null
          servanahq_synced_at?: string | null
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
            foreignKeyName: "callcapture_leads_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "callcapture_appointments"
            referencedColumns: ["id"]
          },
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
      callcapture_voice_catalog: {
        Row: {
          accent: string | null
          best_use: string | null
          created_at: string
          customer_category: string
          description: string | null
          id: string
          is_active: boolean
          label: string
          local_preview_url: string | null
          pace: string | null
          persona: string
          preview_source: string
          provider: string
          provider_preview_url: string | null
          provider_voice_id: string
          sort_order: number
          tone: string | null
          updated_at: string
          verified_active: boolean
        }
        Insert: {
          accent?: string | null
          best_use?: string | null
          created_at?: string
          customer_category?: string
          description?: string | null
          id?: string
          is_active?: boolean
          label: string
          local_preview_url?: string | null
          pace?: string | null
          persona?: string
          preview_source?: string
          provider: string
          provider_preview_url?: string | null
          provider_voice_id: string
          sort_order?: number
          tone?: string | null
          updated_at?: string
          verified_active?: boolean
        }
        Update: {
          accent?: string | null
          best_use?: string | null
          created_at?: string
          customer_category?: string
          description?: string | null
          id?: string
          is_active?: boolean
          label?: string
          local_preview_url?: string | null
          pace?: string | null
          persona?: string
          preview_source?: string
          provider?: string
          provider_preview_url?: string | null
          provider_voice_id?: string
          sort_order?: number
          tone?: string | null
          updated_at?: string
          verified_active?: boolean
        }
        Relationships: []
      }
      callcapture_webhook_events: {
        Row: {
          client_id: string | null
          created_at: string
          detail: Json | null
          id: string
          status: string
          step: string
          vapi_call_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          detail?: Json | null
          id?: string
          status: string
          step: string
          vapi_call_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          detail?: Json | null
          id?: string
          status?: string
          step?: string
          vapi_call_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "callcapture_webhook_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "callcapture_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      is_current_user_super_admin: { Args: never; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      owns_client: { Args: { _client_id: string }; Returns: boolean }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
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
