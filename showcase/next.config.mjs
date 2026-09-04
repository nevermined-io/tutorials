/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone build → a minimal self-contained server for the Docker image.
  output: "standalone",
  reactStrictMode: true,
};

export default nextConfig;
