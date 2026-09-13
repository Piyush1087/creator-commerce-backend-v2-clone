FROM node:20-bookworm-slim AS builder

WORKDIR /usr/src/app

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV HUSKY=0 CI=true
# Browsers are installed in the chromium stage, not during npm ci.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npx prisma generate
# `npm run build` = nest build + copy-prompt-assets.mjs (prompt .md into dist/)
RUN npm run build

# Pin the Chromium layer to the lockfile Playwright version only.
# App code and other dependency bumps must not re-download browsers.
FROM node:20-bookworm-slim AS playwright-version
COPY package-lock.json /package-lock.json
RUN node -e "const v=require('/package-lock.json').packages['node_modules/playwright']?.version; if(!v) throw new Error('playwright missing from package-lock.json'); require('fs').writeFileSync('/playwright-version', v);"

FROM node:20-bookworm-slim AS chromium
WORKDIR /usr/src/app

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates ffmpeg \
  && rm -rf /var/lib/apt/lists/*

COPY --from=playwright-version /playwright-version /playwright-version
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN PW_VERSION="$(cat /playwright-version)" \
  && npx --yes "playwright@${PW_VERSION}" install --with-deps chromium

FROM chromium AS runner
WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/tsconfig*.json ./
COPY --from=builder /usr/src/app/scripts ./scripts
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PORT=80
EXPOSE 80

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm", "run", "start:prod"]
