FROM node:20-bookworm-slim AS builder

WORKDIR /usr/src/app

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV HUSKY=0 CI=true

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /usr/src/app

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/dist ./dist

ENV PORT=80
EXPOSE 80

# Migrations are intentionally manual for now. Run prisma migrate deploy only
# after reviewing and verifying the target database.
CMD ["npm", "run", "start:prod"]
