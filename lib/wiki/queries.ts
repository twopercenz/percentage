import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
export type RevisionRow = Database["public"]["Tables"]["revisions"]["Row"];

export async function getDocumentByFullTitle(fullTitle: string): Promise<DocumentRow | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("full_title", fullTitle)
    .eq("is_deleted", false)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getRevisionById(revisionId: string): Promise<RevisionRow | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("revisions")
    .select("*")
    .eq("id", revisionId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getRevisionsByDocumentId(documentId: string): Promise<RevisionRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("revisions")
    .select("*")
    .eq("document_id", documentId)
    .order("rev_number", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getRevisionByNumber(
  documentId: string,
  revNumber: number,
): Promise<RevisionRow | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("revisions")
    .select("*")
    .eq("document_id", documentId)
    .eq("rev_number", revNumber)
    .maybeSingle();

  if (error) throw error;
  return data;
}
