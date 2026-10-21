# syntax=docker/dockerfile:1.7
# ── deps ──────────────────────────────────────────────────────────────────────
FROM node:22-slim AS deps
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
# Optional extra CA for builds behind TLS-inspecting proxies: `--secret id=ca,src=ca.crt`.
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then cp /run/secrets/ca /usr/local/share/extra-ca.crt; else touch /usr/local/share/extra-ca.crt; fi
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/extra-ca.crt
RUN npm install -g pnpm@10.28.0 --no-fund --no-audit
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/ingest/package.json packages/ingest/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# ── build ─────────────────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_TILE_URL
ARG NEXT_PUBLIC_TILE_ATTRIBUTION
RUN pnpm --filter web build \
 && cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static \
 && cp -r apps/web/public apps/web/.next/standalone/apps/web/public \
 && pnpm --filter @torob/ingest deploy --legacy --prod /ingest

# ── runtime ───────────────────────────────────────────────────────────────────
FROM node:22-slim AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
# Next.js standalone server
COPY --from=build /app/apps/web/.next/standalone ./
# Self-contained migrations + dataset ingest with production deps only (run at boot)
COPY --from=build /ingest /ingest
COPY infra/start.sh ./start.sh
RUN chmod +x start.sh && mkdir -p /data && chown -R node:node /app /data /ingest
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["./start.sh"]
