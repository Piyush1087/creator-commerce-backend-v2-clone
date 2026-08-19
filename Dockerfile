FROM node:20-bookworm-slim AS builder

WORKDIR /usr/src/app

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV HUSKY=0 CI=true

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npx prisma generate
# `npm run build` = nest build + copy-prompt-assets.mjs (prompt .md into dist/)
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /usr/src/app

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/tsconfig*.json ./
COPY --from=builder /usr/src/app/scripts ./scripts
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Brand onboarding Stage 1A — Playwright Chromium for ECS (arm64 + amd64).
# Browsers land under /ms-playwright so the slim image can find them at runtime.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install --with-deps chromium

ENV PORT=80
EXPOSE 80

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm", "run", "start:prod"]
