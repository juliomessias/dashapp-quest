import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  outputFileTracingIncludes: { '/*': ['./db/migrations/*.sql'] },
};

export default nextConfig;
