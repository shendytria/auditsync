import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const INTERNAL_PREFIXES = [
  '/dashboard',
  '/users',
  '/checklist',
  '/laporan-temuan',
  '/laporan-bukti-perbaikan',
  '/verifikasi',
  '/report',
  '/audit-trail',
  '/setting',
  '/profile',
];

const ALLOWED_PARAMS: Record<string, string[]> = {
  '/': [],
  '/login': [],
  '/forgot-password': [],
  '/reset-password': ['token'],
};

function buildCsp(nonce: string, isInternal: boolean = false) {
  const isDev = process.env.NODE_ENV !== 'production';
  return [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ''}`,
    "worker-src 'self' blob:",
    isInternal
      ? "style-src 'self' 'unsafe-inline'"
      : `style-src 'self' 'nonce-${nonce}'`,
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
  const { pathname, searchParams } = request.nextUrl;

  // Hanya halaman terautentikasi internal yang memakai CSP longgar (style-src 'unsafe-inline' untuk Recharts)
  // Semua path lainnya (publik, 404, probe scanner seperti /.env, /admin) mendapat CSP ketat default
  const isInternal = INTERNAL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
  );
  const csp = buildCsp(nonce, isInternal);

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