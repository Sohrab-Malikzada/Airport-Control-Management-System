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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          created_by: string | null
          flight_id: string | null
          id: string
          is_acknowledged: boolean
          is_active: boolean
          message: string
          runway_id: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          title: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          created_by?: string | null
          flight_id?: string | null
          id?: string
          is_acknowledged?: boolean
          is_active?: boolean
          message: string
          runway_id?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          title: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          created_by?: string | null
          flight_id?: string | null
          id?: string
          is_acknowledged?: boolean
          is_active?: boolean
          message?: string
          runway_id?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "flights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_runway_id_fkey"
            columns: ["runway_id"]
            isOneToOne: false
            referencedRelation: "runways"
            referencedColumns: ["id"]
          },
        ]
      }
      flights: {
        Row: {
          actual_arrival: string | null
          actual_departure: string | null
          aircraft_type: string
          airline: string
          capacity: number
          created_at: string
          created_by: string | null
          destination: string
          flight_number: string
          gate: string | null
          id: string
          notes: string | null
          origin: string
          runway_id: string | null
          scheduled_arrival: string
          scheduled_departure: string
          status: Database["public"]["Enums"]["flight_status"]
          updated_at: string
        }
        Insert: {
          actual_arrival?: string | null
          actual_departure?: string | null
          aircraft_type?: string
          airline: string
          capacity?: number
          created_at?: string
          created_by?: string | null
          destination: string
          flight_number: string
          gate?: string | null
          id?: string
          notes?: string | null
          origin: string
          runway_id?: string | null
          scheduled_arrival: string
          scheduled_departure: string
          status?: Database["public"]["Enums"]["flight_status"]
          updated_at?: string
        }
        Update: {
          actual_arrival?: string | null
          actual_departure?: string | null
          aircraft_type?: string
          airline?: string
          capacity?: number
          created_at?: string
          created_by?: string | null
          destination?: string
          flight_number?: string
          gate?: string | null
          id?: string
          notes?: string | null
          origin?: string
          runway_id?: string | null
          scheduled_arrival?: string
          scheduled_departure?: string
          status?: Database["public"]["Enums"]["flight_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flights_runway_id_fkey"
            columns: ["runway_id"]
            isOneToOne: false
            referencedRelation: "runways"
            referencedColumns: ["id"]
          },
        ]
      }
      passengers: {
        Row: {
          boarding_status: Database["public"]["Enums"]["passenger_boarding_status"]
          created_at: string
          first_name: string
          flight_id: string
          id: string
          last_name: string
          nationality: string
          passport_number: string
          seat_number: string | null
          ticket_id: string
          updated_at: string
        }
        Insert: {
          boarding_status?: Database["public"]["Enums"]["passenger_boarding_status"]
          created_at?: string
          first_name: string
          flight_id: string
          id?: string
          last_name: string
          nationality?: string
          passport_number: string
          seat_number?: string | null
          ticket_id?: string
          updated_at?: string
        }
        Update: {
          boarding_status?: Database["public"]["Enums"]["passenger_boarding_status"]
          created_at?: string
          first_name?: string
          flight_id?: string
          id?: string
          last_name?: string
          nationality?: string
          passport_number?: string
          seat_number?: string | null
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "passengers_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "flights"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      runways: {
        Row: {
          created_at: string
          id: string
          length_meters: number
          name: string
          notes: string | null
          status: Database["public"]["Enums"]["runway_status"]
          surface_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          length_meters?: number
          name: string
          notes?: string | null
          status?: Database["public"]["Enums"]["runway_status"]
          surface_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          length_meters?: number
          name?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["runway_status"]
          surface_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      alert_severity: "info" | "warning" | "critical" | "emergency"
      app_role: "admin" | "atc" | "staff"
      flight_status:
        | "scheduled"
        | "boarding"
        | "delayed"
        | "departed"
        | "landed"
        | "cancelled"
        | "emergency"
      passenger_boarding_status:
        | "checked_in"
        | "boarding"
        | "boarded"
        | "no_show"
      runway_status: "available" | "occupied" | "maintenance" | "closed"
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
      alert_severity: ["info", "warning", "critical", "emergency"],
      app_role: ["admin", "atc", "staff"],
      flight_status: [
        "scheduled",
        "boarding",
        "delayed",
        "departed",
        "landed",
        "cancelled",
        "emergency",
      ],
      passenger_boarding_status: [
        "checked_in",
        "boarding",
        "boarded",
        "no_show",
      ],
      runway_status: ["available", "occupied", "maintenance", "closed"],
    },
  },
} as const
