import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/signup"];

// Optimistic check only; pages and actions still call requireUser().
export async function proxy(req: NextRequest) {
  const signedIn = Boolean(await verifySession(req.cookies.get(SESSION_COOKIE)?.value));
  const isPublic = PUBLIC_PATHS.includes(req.nextUrl.pathname) || req.nextUrl.pathname.startsWith("/share/");
  if (!signedIn && !isPublic) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|tuxemon/|models/|.*\\.(?:png|jpg|jpeg|svg|webp|gif|glb|gltf|ico|txt)$).*)"],
};
