import { NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // api/discord is excluded on purpose: Discord POSTs with no cookies, so the
    // session guard would bounce every interaction to /login. That endpoint
    // authenticates by Ed25519 request signature instead.
    "/((?!_next/static|_next/image|favicon.ico|api/discord|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
