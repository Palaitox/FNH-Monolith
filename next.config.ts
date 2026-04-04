import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  webpack: (config) => {
    // @react-pdf/renderer uses `canvas` internally which doesn't exist in Node.js.
    // Marking it as external prevents the SSR bundle from trying to require it.
    config.externals = [...(config.externals ?? []), { canvas: 'canvas' }]
    return config
  },
}

export default nextConfig
