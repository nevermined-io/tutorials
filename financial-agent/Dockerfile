FROM node:20-alpine
LABEL maintainer="Nevermined <root@nevermined.io>"

RUN apk add --no-cache libc6-compat autoconf automake alpine-sdk xdg-utils gettext yarn

WORKDIR /app

# Install dependencies with Yarn (no lockfile required)
COPY package.json ./
RUN yarn install --non-interactive

# Rebuild the source code only when needed
COPY agent ./agent
COPY client ./client
COPY tsconfig.json ./

RUN yarn build

EXPOSE 3000

ENTRYPOINT [ "yarn", "start:financial" ]