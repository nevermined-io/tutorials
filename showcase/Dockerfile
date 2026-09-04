# Nevermined Tutorials showcase — production image (Next.js standalone).
#
# Build from the REPO ROOT so the catalog demo media (committed under catalog/)
# is in the build context:
#
#   docker build -f showcase/Dockerfile -t nvm-tutorials-showcase .
#   docker run -p 3000:3000 nvm-tutorials-showcase
#
# The container listens on $PORT (default 3000) on 0.0.0.0 — ready for a k8s
# Service / ArgoCD Deployment.

# ---- dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY showcase/package.json showcase/package-lock.json ./
RUN npm ci

# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY showcase/ ./
# The demo videos are gitignored under showcase/public — pull them from the
# committed catalog/ demos so the recap/discover panels play in the image.
COPY catalog/discover-the-catalog/discover-the-catalog.mp4 ./public/media/discover-the-catalog/
COPY catalog/song-from-the-headlines/song-from-the-headlines.mp4 ./public/media/song-from-the-headlines/
COPY catalog/diligence-in-a-box/diligence-in-a-box.mp4 ./public/media/diligence-in-a-box/
RUN npm run build

# ---- runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
