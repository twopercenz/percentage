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

export async function getExistingFullTitles(fullTitles: string[]): Promise<Set<string>> {
  if (fullTitles.length === 0) return new Set();

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("documents")
    .select("full_title")
    .eq("is_deleted", false)
    .in("full_title", fullTitles);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.full_title));
}

export type RecentRevisionRow = RevisionRow & {
  documentFullTitle: string;
  documentIsDeleted: boolean;
};

export async function getRecentRevisions(limit = 50): Promise<RecentRevisionRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data: revisions, error } = await supabase
    .from("revisions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  if (!revisions || revisions.length === 0) return [];

  const documentIds = [...new Set(revisions.map((revision) => revision.document_id))];
  const { data: documents, error: documentsError } = await supabase
    .from("documents")
    .select("id, full_title, is_deleted")
    .in("id", documentIds);

  if (documentsError) throw documentsError;
  const documentById = new Map((documents ?? []).map((document) => [document.id, document]));

  return revisions.flatMap((revision) => {
    const document = documentById.get(revision.document_id);
    if (!document) return [];
    return [
      {
        ...revision,
        documentFullTitle: document.full_title,
        documentIsDeleted: document.is_deleted,
      },
    ];
  });
}

export async function searchDocuments(query: string, limit = 20): Promise<DocumentRow[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("is_deleted", false)
    .ilike("full_title", `%${trimmed}%`)
    .order("full_title", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

type DocumentSummary = Pick<DocumentRow, "id" | "full_title">;

async function getDocumentsByIds(ids: string[]): Promise<DocumentSummary[]> {
  if (ids.length === 0) return [];

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, full_title")
    .eq("is_deleted", false)
    .in("id", ids)
    .order("full_title", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// 이 문서를 링크하는 다른 문서 목록(역링크). backlinks는 문서 저장 시 재계산된다.
export async function getBacklinks(toFullTitle: string): Promise<DocumentSummary[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("backlinks")
    .select("from_document_id")
    .eq("to_full_title", toFullTitle);

  if (error) throw error;
  const documentIds = [...new Set((data ?? []).map((row) => row.from_document_id))];
  return getDocumentsByIds(documentIds);
}

// 이 분류에 속한 문서 목록. 분류 문서(namespace === "분류")를 볼 때 하단에 표시한다.
export async function getCategoryMembers(categoryFullTitle: string): Promise<DocumentSummary[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("document_categories")
    .select("document_id")
    .eq("category_full_title", categoryFullTitle);

  if (error) throw error;
  const documentIds = [...new Set((data ?? []).map((row) => row.document_id))];
  return getDocumentsByIds(documentIds);
}
