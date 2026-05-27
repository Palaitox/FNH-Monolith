import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Transpile Supabase packages so their modern JS (??  ?.) is converted
  // to syntax that iOS 12 / Safari 12 can parse. Without this, the auth
  // flow silently fails on older devices.
  transpilePackages: ['@supabase/ssr', '@supabase/supabase-js'],
  webpack: (config) => {
    // @react-pdf/renderer uses `canvas` internally which doesn't exist in Node.js.
    // Marking it as external prevents the SSR bundle from trying to require it.
    config.externals = [...(config.externals ?? []), { canvas: 'canvas' }]
    return config
  },
}

export default nextConfig
