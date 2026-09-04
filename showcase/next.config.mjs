/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone build → a minimal self-contained server for the Docker image.
  output: "standalone",
  reactStrictMode: true,
  // The payments SDK's root import pulls its MCP submodule (optional peer
  // @modelcontextprotocol/sdk) which we don't use. Load it as a runtime require in the
  // server (as Node does for the agent) instead of bundling it, so the unused MCP peer
  // isn't required at build time.
  serverExternalPackages: ["@nevermined-io/payments"],
};

export default nextConfig;
