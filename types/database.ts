// 손으로 작성한 초기 타입입니다. 로컬/원격 Supabase 프로젝트에 연결한 뒤
// `bun run db:types`로 재생성하고, 이후로는 직접 수정하지 않습니다.

export type RevisionType = "create" | "modify" | "delete" | "revert" | "move";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          created_at: string;
          permissions: string[];
          is_blocked: boolean;
        };
        Insert: {
          id: string;
          username: string;
          created_at?: string;
          permissions?: string[];
          is_blocked?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          namespace: string;
          title: string;
          full_title: string;
          current_revision_id: string | null;
          is_deleted: boolean;
          redirect_target: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          namespace: string;
          title: string;
          full_title: string;
          current_revision_id?: string | null;
          is_deleted?: boolean;
          redirect_target?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["documents"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "documents_current_revision_id_fkey";
            columns: ["current_revision_id"];
            isOneToOne: false;
            referencedRelation: "revisions";
            referencedColumns: ["id"];
          },
        ];
      };
      revisions: {
        Row: {
          id: string;
          document_id: string;
          rev_number: number;
          content: string;
          comment: string | null;
          type: RevisionType;
          editor_user_id: string | null;
          editor_ip_hash: string | null;
          editor_ip_display: string | null;
          byte_size: number;
          byte_diff: number;
          is_hidden: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          rev_number: number;
          content: string;
          comment?: string | null;
          type: RevisionType;
          editor_user_id?: string | null;
          editor_ip_hash?: string | null;
          editor_ip_display?: string | null;
          byte_size?: number;
          byte_diff?: number;
          is_hidden?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["revisions"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "revisions_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "revisions_editor_user_id_fkey";
            columns: ["editor_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_revision: {
        Args: {
          p_namespace: string;
          p_title: string;
          p_content: string;
          p_comment: string | null;
          p_editor_user_id: string | null;
          p_editor_ip_hash: string | null;
          p_editor_ip_display: string | null;
        };
        Returns: Database["public"]["Tables"]["revisions"]["Row"];
      };
    };
    Enums: Record<string, never>;
  };
};
