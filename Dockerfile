FROM node:22-bookworm-slim

ARG GIT_SHA=local
ENV NODE_ENV=production
ENV GITHUB_SHA=$GIT_SHA

WORKDIR /app

COPY package*.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build && npm prune --omit=dev

RUN mkdir -p /data && chown -R node:node /app /data
USER node

ENV DH_DB_PATH=/data/digital-heroes.sqlite
EXPOSE 8787

CMD ["node", "server.mjs"]
