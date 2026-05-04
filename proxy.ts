import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_ROUTES = ['/', '/api/auth/login', '/api/auth/logout'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ROUTES.some((route) => pathname === route)) {
    return NextResponse.next();
  }

  // Block the x-middleware-subrequest bypass vector (CVE-2025-29927)
  if (request.headers.get('x-middleware-subrequest')) {
    return new NextResponse(null, { status: 403 });
  }

  // UX redirect only — real auth check is requireAuth() in every server action
  const session = request.cookies.get('finlog_session')?.value;
  if (!session) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
