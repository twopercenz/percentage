import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getUsernamesByIds(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("profiles").select("id, username").in("id", ids);

  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.id, row.username]));
}
