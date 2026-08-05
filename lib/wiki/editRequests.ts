import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type EditRequestRow = Database["public"]["Tables"]["edit_requests"]["Row"];

export async function getEditRequestsByDocument(documentId: string): Promise<EditRequestRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("edit_requests")
    .select("*")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}
