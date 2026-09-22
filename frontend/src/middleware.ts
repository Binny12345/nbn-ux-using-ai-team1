import { type NextRequest } from 'next/server'
import { proxy } from './proxy'

export function middleware(req: NextRequest) {
  return proxy(req)
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files and Next internals.
     * Adjust to your needs.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.).*)',
  ],
}