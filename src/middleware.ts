import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const STAFF_COOKIE = 'staff_session'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const staffOk = request.cookies.get(STAFF_COOKIE)?.value === '1'
  if (!staffOk) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Pantallas de selección de área obsoletas: la sesión del dashboard basta.
  if (pathname.startsWith('/admin/login')) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
}
