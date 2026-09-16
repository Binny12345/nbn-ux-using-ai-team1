import { type NextRequest, NextResponse } from 'next/server'

const PROTECTED_ROUTES = ['/dashboard', '/projects', '/profile', '/settings']
const AUTH_ROUTES = ['/auth/signin', '/auth/signup']

/**
 * Optimistic proxy — checks for the presence of the session cookie only.
 * Cryptographic token verification happens in Server Actions and Route Handlers
 * using the Firebase Admin SDK (near the data, not at the edge).
 */
export function proxy(req: NextRequest) {
  const sessionCookie = req.cookies.get('__session')?.value
  const isAuthenticated = Boolean(sessionCookie)
  const { pathname } = req.nextUrl

  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route))
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route))

  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL('/auth/signin', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/projects', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, public assets
     * - api routes (they handle their own auth)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/|images/).*)',
  ],
}
