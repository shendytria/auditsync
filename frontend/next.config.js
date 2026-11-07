/** @type {import('next').NextConfig} */

const backendOrigin = process.env.NEXT_PUBLIC_API_ORIGIN || 'http://localhost:8080';

const nextConfig = {
  poweredByHeader: false,

  // Proxy semua request /api/* dan /uploads/* ke backend secara server-side
  // Browser hanya fetch ke origin sendiri → tidak ada Mixed Content error
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/:path*',
          has: [
            {
              type: 'header',
              key: 'next-router-state-tree',
              value: "(?![A-Za-z0-9_.!~*'()%-]*$).+",
            },
          ],
          destination: '/blocked-request',
        },
      ],
      afterFiles: [
        { source: '/api/:path*', destination: `${backendOrigin}/api/:path*` },
        { source: '/uploads/:path*', destination: `${backendOrigin}/uploads/:path*` },
      ],
    };
  },

  // CSP dibuat per request (dengan nonce) di middleware.ts
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;