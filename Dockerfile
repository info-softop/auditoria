# syntax=docker/dockerfile:1.7
# Multi-stage para Next.js 16 (output standalone) + Prisma, optimizado para Cloud Run.
#   Build:  docker build -t auditoria .
#   Run:    docker run -p 8080:8080 -e DATABASE_URL=... -e AUTH_SECRET=... auditoria

ARG NODE_VERSION=22-slim

# ── deps: instala dependencias (con dev, necesarias para el build) ──────────
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ── builder: genera el cliente Prisma y compila Next ───────────────────────
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DATABASE_URL ficticio solo para el build (Prisma generate / next build no
# conectan a la BD). En runtime lo sobreescribe la variable real.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

# ── migrator: corre `prisma migrate deploy` (Cloud Run Job antes del deploy) ─
#   Reusa la stage builder (ya tiene Prisma CLI + schema + migraciones); solo
#   cambia el CMD. DATABASE_URL real llega por secret al ejecutar el job.
FROM builder AS migrator
WORKDIR /app
CMD ["npx", "prisma", "migrate", "deploy"]

# ── runner: imagen mínima con el standalone ────────────────────────────────
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Usuario no-root (buena práctica en Cloud Run)
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Artefactos del standalone + estáticos + assets públicos
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Garantiza el cliente/motor de Prisma dentro del runner
COPY --from=builder /app/src/generated/prisma ./src/generated/prisma

USER nextjs
EXPOSE 8080
CMD ["node", "server.js"]
