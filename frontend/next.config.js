/** @type {import('next').NextConfig} */

const backendOrigin = process.env.NEXT_PUBLIC_API_ORIGIN || 'http://localhost:8080';
const backendOriginNoScheme = backendOrigin.replace(/^https?:\/\//, '');

const nextConfig = {
  poweredByHeader: false,

  // Proxy semua request /api/* dan /uploads/* ke backend secara server-side
  // Browser hanya fetch ke origin sendiri → tidak ada Mixed Content error
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendOrigin}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${backendOrigin}/uploads/:path*`,
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://placehold.co http://${backendOriginNoScheme} https://${backendOriginNoScheme}; connect-src 'self' data: http://${backendOriginNoScheme} https://${backendOriginNoScheme}; object-src 'none'; base-uri 'self'; frame-ancestors 'none';`,
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "no-referrer",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;