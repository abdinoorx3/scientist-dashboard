import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  basePath: process.env.NEXT_PUBLIC_DASHBOARD_BASE_PATH || '',
  turbopack: { root: __dirname },
}

export default nextConfig
