# =============================================================================
# Stage 1: Dependencies
# =============================================================================
FROM node:20-bookworm-slim AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# =============================================================================
# Stage 2: Builder
# =============================================================================
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Ensure public directory exists (Next.js requires it)
RUN mkdir -p public

# Build the Next.js application
RUN npm run build

# =============================================================================
# Stage 3: Production Runner
# =============================================================================
FROM node:20-bookworm-slim AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
# PORT is set by Cloud Run at runtime (default 8080)
# Do NOT hardcode PORT here

# Copy package files (needed for npm start)
COPY --from=builder /app/package.json /app/package-lock.json ./

# Copy Next.js config
COPY --from=builder /app/next.config.mjs ./next.config.mjs

# Copy TypeScript config (needed for ts-node in workers)
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Copy built Next.js application
COPY --from=builder /app/.next ./.next

# Copy public assets (if any)
COPY --from=builder /app/public ./public

# Copy production node_modules
# Note: This includes ts-node and tsconfig-paths which are production deps
COPY --from=builder /app/node_modules ./node_modules

# Copy worker scripts
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/workers ./workers

# Copy source files (needed for ts-node compilation at runtime)
COPY --from=builder /app/src ./src

# Copy data files (JSON configs used by the app)
COPY --from=builder /app/data ./data

# Expose port (Cloud Run uses PORT env var, default 8080)
EXPOSE 8080

# Start command - uses scripts/start.js which handles web/worker mode
CMD ["npm", "run", "start"]
