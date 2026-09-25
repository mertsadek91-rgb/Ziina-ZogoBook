FROM node:22-alpine AS base
RUN apk add --no-cache openssl

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
# `npm ci` can reject the lockfile on Linux because of optional wasm packages bundled by
# Tailwind (@emnapi/*, a known npm issue); fall back to `npm install`, which keeps locked versions.
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npx next build

FROM base AS run
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# DATABASE_URL (MySQL) is provided by the platform at runtime, e.g. Coolify environment variables.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
# Files in /public (logo, icons) are not part of the standalone output.
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
# Prisma CLI (for `migrate deploy` at startup) installed with all its dependencies,
# pinned to the same version as @prisma/client.
RUN npm install -g prisma@6.19.3 && npm cache clean --force
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 CMD wget -qO- http://127.0.0.1:3000/login >/dev/null || exit 1
CMD ["sh", "-c", "prisma migrate deploy && node server.js"]
