import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_COOKIE = 'admin_session'
const STAFF_COOKIE = 'staff_session'
const VALID_ROLES = ['psi_mk', 'psi_pri', 'psi_sec', 'vin_mk', 'vin_pri']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const staffOk = request.cookies.get(STAFF_COOKIE)?.value === '1'
  if (!staffOk) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (
    pathname.startsWith('/admin/login') ||
    pathname.startsWith('/admin/dashboard')
  ) {
    return NextResponse.next()
  }

  const role = request.cookies.get(ADMIN_COOKIE)?.value
  if (!role || !VALID_ROLES.includes(role)) {
    const loginUrl = new URL('/admin/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
}
