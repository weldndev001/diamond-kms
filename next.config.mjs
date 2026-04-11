/** @type {import('next').NextConfig} */
const nextConfig = {
    // output: 'standalone', // Removed for Vercel deployment compatibility
    allowedDevOrigins: ['diamondkms-dev.weldn.ai'],
    experimental: {
        serverActions: {
            bodySizeLimit: '10mb',
        },
    },
};

export default nextConfig;
