import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type DiscussionRow = Database["public"]["Tables"]["discussions"]["Row"];
export type DiscussionCommentRow = Database["public"]["Tables"]["discussion_comments"]["Row"];

// 활발한(최근에 댓글 달린) 토론이 위로 오도록 updated_at 기준 최신순이다.
export async function getDiscussionsByDocument(documentId: string): Promise<DiscussionRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("discussions")
    .select("*")
    .eq("document_id", documentId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getDiscussionById(id: string): Promise<DiscussionRow | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("discussions").select("*").eq("id", id).maybeSingle();

  if (error) throw error;
  return data;
}

export async function getCommentsByDiscussion(discussionId: string): Promise<DiscussionCommentRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("discussion_comments")
    .select("*")
    .eq("discussion_id", discussionId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
