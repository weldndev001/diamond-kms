/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone', // Required for staying under Vercel's 250MB size limit by optimizing dependencies tracing
    allowedDevOrigins: ['diamondkms-dev.weldn.ai'],
    experimental: {
        serverActions: {
            bodySizeLimit: '10mb',
        },
    },
};

export default nextConfig;
