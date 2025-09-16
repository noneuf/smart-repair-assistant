/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // keep these as external so the path points to node_modules (real binary), not a bundled chunk
    serverComponentsExternalPackages: ['ffmpeg-static', 'fluent-ffmpeg'],
  },
  webpack(config, { isServer }) {
    if (isServer) {
      // ensure ffmpeg-static is treated as a server external (commonjs), not inlined
      config.externals = config.externals || [];
      config.externals.push({ 'ffmpeg-static': 'commonjs ffmpeg-static' });
    }
    return config;
  },
};

export default nextConfig;
