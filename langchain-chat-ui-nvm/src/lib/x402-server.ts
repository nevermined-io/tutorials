/**
 * Constants shared across the Nevermined x402 server-side route handlers.
 *
 * Lives in `src/lib` rather than next to a route file because Next.js
 * App Router routes can only export GET / POST / runtime / etc — any
 * additional export breaks the build.
 */

export const NVM_X402_TOKEN_COOKIE = "nvm_x402_access_token";
