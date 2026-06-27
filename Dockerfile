# Aries hosted MCP server — Streamable HTTP transport.
# Node service (NOT the nginx static-site pattern used by frank-web/bragi-web).
#
# Build:  docker build -t aries-mcp:dev .
# Run:    docker run -d --name aries-mcp --restart unless-stopped \
#           --network alkanes-regtest_regtest-net \
#           --env-file <key-file> aries-mcp:dev
# Internal only: no -p / host publish, no edge route (that is a later phase).

# ---- build stage: compile TypeScript ----
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- runtime stage: prod deps + compiled output + corpus ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY corpus ./corpus

# HTTP launch mode, internal bind. Key is injected at run time via --env-file,
# never baked into the image.
ENV ARIES_TRANSPORT=http
ENV ARIES_HTTP_HOST=0.0.0.0
ENV ARIES_HTTP_PORT=8810
ENV ARIES_HTTP_PATH=/mcp
# Persistent learning store lives under /data, a bind-mount supplied at run time
# (-v /home/bragi/aries-data:/data). incidents.ts derives the trusted + pending
# JSONL files from ARIES_DATA_DIR, so nothing here is ephemeral. The dir is
# created/written by the node user (uid 1000); the host dir is owned to match.
ENV ARIES_DATA_DIR=/data

EXPOSE 8810
USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8810/healthz').then(r=>{if(!r.ok)process.exit(1);return r.json()}).then(()=>process.exit(0)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
