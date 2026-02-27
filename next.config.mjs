import path from 'node:path'
/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: [
    // pnpm exec next dev --hostname 0.0.0.0 --port 3000
    // cloudflared tunnel --url http://localhost:3000
    '',
  ],
  images: {
    unoptimized: true,
  },
  async rewrites() {
    const projectBase = path.basename(process.cwd())
    return [
      {
        source: '/public/api/:path*',
        destination: `http://localhost/${projectBase}/public/api/:path*`,
      },
    ]
  },
}

export default nextConfig
