FROM node:22-alpine
LABEL maintainer="Nevermined <root@nevermined.io>"
RUN apk add --no-cache libc6-compat yarn
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive
COPY src ./src
COPY tsconfig.json ./
RUN yarn build
EXPOSE 3000
ENTRYPOINT ["yarn", "start"]
