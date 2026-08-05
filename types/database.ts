export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      backlinks: {
        Row: {
          created_at: string
          from_document_id: string
          id: string
          to_full_title: string
        }
        Insert: {
          created_at?: string
          from_document_id: string
          id?: string
          to_full_title: string
        }
        Update: {
          created_at?: string
          from_document_id?: string
          id?: string
          to_full_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "backlinks_from_document_id_fkey"
            columns: ["from_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_categories: {
        Row: {
          category_full_title: string
          created_at: string
          document_id: string
          id: string
        }
        Insert: {
          category_full_title: string
          created_at?: string
          document_id: string
          id?: string
        }
        Update: {
          category_full_title?: string
          created_at?: string
          document_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_categories_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          current_revision_id: string | null
          full_title: string
          id: string
          is_deleted: boolean
          namespace: string
          redirect_target: string | null
          title: string
          updated_at: string
        }
        Insert: {
          current_revision_id?: string | null
          full_title: string
          id?: string
          is_deleted?: boolean
          namespace: string
          redirect_target?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          current_revision_id?: string | null
          full_title?: string
          id?: string
          is_deleted?: boolean
          namespace?: string
          redirect_target?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_current_revision_id_fkey"
            columns: ["current_revision_id"]
            isOneToOne: false
            referencedRelation: "revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          is_blocked: boolean
          permissions: string[]
          username: string
        }
        Insert: {
          created_at?: string
          id: string
          is_blocked?: boolean
          permissions?: string[]
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          is_blocked?: boolean
          permissions?: string[]
          username?: string
        }
        Relationships: []
      }
      revisions: {
        Row: {
          byte_diff: number
          byte_size: number
          comment: string | null
          content: string
          created_at: string
          document_id: string
          editor_ip_display: string | null
          editor_ip_hash: string | null
          editor_user_id: string | null
          id: string
          is_hidden: boolean
          rev_number: number
          type: string
        }
        Insert: {
          byte_diff?: number
          byte_size?: number
          comment?: string | null
          content?: string
          created_at?: string
          document_id: string
          editor_ip_display?: string | null
          editor_ip_hash?: string | null
          editor_user_id?: string | null
          id?: string
          is_hidden?: boolean
          rev_number: number
          type: string
        }
        Update: {
          byte_diff?: number
          byte_size?: number
          comment?: string | null
          content?: string
          created_at?: string
          document_id?: string
          editor_ip_display?: string | null
          editor_ip_hash?: string | null
          editor_user_id?: string | null
          id?: string
          is_hidden?: boolean
          rev_number?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "revisions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revisions_editor_user_id_fkey"
            columns: ["editor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_revision: {
        Args: {
          p_comment: string
          p_content: string
          p_editor_ip_display: string
          p_editor_ip_hash: string
          p_namespace: string
          p_title: string
        }
        Returns: {
          byte_diff: number
          byte_size: number
          comment: string | null
          content: string
          created_at: string
          document_id: string
          editor_ip_display: string | null
          editor_ip_hash: string | null
          editor_user_id: string | null
          id: string
          is_hidden: boolean
          rev_number: number
          type: string
        }
        SetofOptions: {
          from: "*"
          to: "revisions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_document: {
        Args: {
          p_comment: string
          p_full_title: string
        }
        Returns: {
          byte_diff: number
          byte_size: number
          comment: string | null
          content: string
          created_at: string
          document_id: string
          editor_ip_display: string | null
          editor_ip_hash: string | null
          editor_user_id: string | null
          id: string
          is_hidden: boolean
          rev_number: number
          type: string
        }
        SetofOptions: {
          from: "*"
          to: "revisions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      move_document: {
        Args: {
          p_comment: string
          p_from_full_title: string
          p_to_namespace: string
          p_to_title: string
        }
        Returns: string
      }
      revert_revision: {
        Args: {
          p_comment: string
          p_document_id: string
          p_editor_ip_display: string
          p_editor_ip_hash: string
          p_target_revision_id: string
        }
        Returns: {
          byte_diff: number
          byte_size: number
          comment: string | null
          content: string
          created_at: string
          document_id: string
          editor_ip_display: string | null
          editor_ip_hash: string | null
          editor_user_id: string | null
          id: string
          is_hidden: boolean
          rev_number: number
          type: string
        }
        SetofOptions: {
          from: "*"
          to: "revisions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sync_document_links: {
        Args: {
          p_categories: string[]
          p_document_id: string
          p_link_targets: string[]
        }
        Returns: undefined
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

