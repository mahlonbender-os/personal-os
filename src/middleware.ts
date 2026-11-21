import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Gate API routes only. Page routes stay on their existing session checks
// so the Google sign-in screen is not redirected by middleware.
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // NextAuth, Health Auto Export, and Vercel Cron each authenticate themselves.
  if (
    pathname === '/api/auth' ||
    pathname.startsWith('/api/auth/') ||
    pathname === '/api/ingest/health' ||
    pathname === '/api/cron' ||
    pathname.startsWith('/api/cron/')
  ) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
