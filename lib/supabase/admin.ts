import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// service_role 키를 사용하는 클라이언트. 서버 전용 코드에서만 import한다.
export function createAdminSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
