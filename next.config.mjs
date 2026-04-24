/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone', // Required for staying under Vercel's 250MB size limit by optimizing dependencies tracing
    experimental: {
        serverComponentsExternalPackages: ['@ffmpeg-installer/ffmpeg', '@ffprobe-installer/ffprobe'],
        serverActions: {
            bodySizeLimit: '10mb',
        },
        outputFileTracingExcludes: {
            '*': [
                '.next/cache/**',
                'node_modules/@swc/core-linux-x64-gnu/**',
                'node_modules/@swc/core-linux-x64-musl/**',
                'node_modules/@esbuild/linux-x64/**',
            ],
        },
    },
};

export default nextConfig;
