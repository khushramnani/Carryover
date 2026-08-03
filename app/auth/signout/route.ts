import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Sign out and land on /login with an optional reason.
 *
 * Exists because Server Components can't write cookies — the 7-day guild
 * re-verification in (app)/layout.tsx needs somewhere to actually drop the
 * session when someone has been kicked from the server.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const reason = searchParams.get("error");

  const supabase = await createClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(
    `${origin}/login${reason ? `?error=${encodeURIComponent(reason)}` : ""}`,
  );
}
