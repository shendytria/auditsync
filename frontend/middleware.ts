import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ALLOWED_PARAMS: Record<string, string[]> = {
  '/': [],
  '/login': [],
  '/forgot-password': [],
  '/reset-password': ['token'],
};

function buildCsp(nonce: string) {
  const isDev = process.env.NODE_ENV !== 'production';
  return [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ''}`,
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://placehold.co",
    "font-src 'self'",
    "connect-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ') + ';';
}

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp(nonce);
  const withCsp = (res: NextResponse) => {
    res.headers.set('Content-Security-Policy', csp);
    return res;
  };

  if (request.method === 'OPTIONS') return withCsp(new NextResponse(null, { status: 404 }));

  // Header router state yang valid hanya berisi karakter hasil encodeURIComponent
  const routerTree = request.headers.get('next-router-state-tree');
  if (routerTree && /[^A-Za-z0-9_.!~*'()%-]/.test(routerTree)) {
    return withCsp(new NextResponse('Bad Request', { status: 400 }));
  }

  const { pathname, searchParams } = request.nextUrl;

  if (pathname === '/_next/image') {
    const imgUrl = searchParams.get('url') ?? '';
    try {
      decodeURIComponent(imgUrl);
    } catch {
      return withCsp(new NextResponse('Bad Request', { status: 400 }));
    }
  }

  if (pathname === '/_next/static' || pathname === '/_next/static/') {
    return withCsp(new NextResponse(null, { status: 404 }));
  }

  const allowed = ALLOWED_PARAMS[pathname];
  if (allowed !== undefined) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return withCsp(new NextResponse('Method Not Allowed', { status: 405 }));
    }
    if (searchParams.toString()) {
      const filtered = new URLSearchParams();
      for (const key of allowed) {
        if (searchParams.has(key)) filtered.set(key, searchParams.get(key)!);
      }
      if (filtered.toString() !== searchParams.toString()) {
        const cleanUrl = request.nextUrl.clone();
        cleanUrl.search = filtered.toString();
        return withCsp(NextResponse.redirect(cleanUrl, 308));
      }
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  return withCsp(NextResponse.next({ request: { headers: requestHeaders } }));
}

export const config = {
  matcher: [
    '/((?!api|_next/static).*)',
    '/_next/static',
  ],
};