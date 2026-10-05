# ---- Stage 1: dependencies (incl. dev, used for tests) ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

# ---- Stage 2: run unit tests (build fails if tests fail) ----
FROM deps AS test
COPY server.js ./
COPY public ./public
COPY test ./test
RUN npm test

# ---- Stage 3: production deps only ----
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# ---- Stage 4: small runtime image, non-root ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json server.js ./
COPY public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q --spider http://localhost:3000/health || exit 1
CMD ["node", "server.js"]
