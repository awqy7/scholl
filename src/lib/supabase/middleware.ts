import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const publicPaths = ["/login", "/auth/callback", "/api/auth"]
  if (process.env.NODE_ENV === "development") {
    publicPaths.push("/api/ia/ping")
  }
  const isPublicPath = publicPaths.some((p) => request.nextUrl.pathname.startsWith(p))

  if (
    !supabaseUrl ||
    !supabaseKey ||
    supabaseUrl.includes("seu-projeto") ||
    supabaseKey === "sua-chave-anon"
  ) {
    if (isPublicPath || request.nextUrl.pathname === "/") {
      return NextResponse.next({ request })
    }
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
