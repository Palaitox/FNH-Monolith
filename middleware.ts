import { updateSession } from '@/lib/middleware'
import { type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // updateSession refreshes the Supabase auth token and handles the
  // redirect to /auth/login for unauthenticated users.
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all routes except:
     *   - _next/static  (static files)
     *   - _next/image   (image optimisation)
     *   - favicon.ico
     *   - public folder files with common extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
