/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Set NEXT_PUBLIC_BASE_PATH=/housekeeping when this app is served under the staff portal
  // (Next.js multi-zones, see docs/INTEGRATION.md). Leave empty to run on its own domain.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  // Keep the staff app out of search engines
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

module.exports = nextConfig;
