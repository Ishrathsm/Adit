import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Terms/Privacy are readable regardless of auth state — never bounced either direction,
  // unlike "/" and "/login" which are only meant for logged-out visitors.
  const isAlwaysAccessible =
    request.nextUrl.pathname.startsWith("/terms") ||
    request.nextUrl.pathname.startsWith("/privacy") ||
    // Opened from a reset email while logged out, and still needed right after the link signs
    // the user in — so it's never bounced in either direction.
    request.nextUrl.pathname.startsWith("/reset-password");
  if (isAlwaysAccessible) return response;

  const isPublicRoute = request.nextUrl.pathname === "/" || request.nextUrl.pathname.startsWith("/login");

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Excludes framework internals plus any request for a static asset file (by extension) —
  // not just specific filenames — so a new /public asset never needs a middleware update to
  // be reachable by logged-out visitors (this bit us before with the favicon, and again with
  // video samples — mp4 wasn't in this list, so /samples/video.mp4 was silently redirected
  // to /login for every logged-out visitor, i.e. the entire marketing-page audience).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|mp4|webm|mov|mp3|wav|ogg|pdf|woff2?|ttf)$).*)",
  ],
};
