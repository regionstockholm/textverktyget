# Multi-stage Docker build for Textverktyg
# Optimized for PostgreSQL-based Node.js application

#
# Build Stage
#
FROM node:20-slim AS builder

# Install build dependencies
RUN apt-get update \
    && apt-get install -y python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files for better layer caching
COPY package.json pnpm-lock.yaml ./
# Copy Prisma schema before postinstall (prisma generate)
COPY prisma ./prisma

# Install all dependencies including dev dependencies for building
RUN corepack enable && corepack use pnpm@10.29.2 && pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
# NODE_ENV=production enables build-time optimizations (minification, console.log removal)
ENV NODE_ENV=production
RUN pnpm run build

# Remove dev dependencies and clean cache
RUN pnpm prune --prod

#
# Production Stage
#
FROM node:20-slim AS production

# Create non-root user for security
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -M -s /usr/sbin/nologin textverktyg

# Install runtime dependencies
RUN apt-get update \
    && apt-get install -y openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=textverktyg:nodejs /app/dist ./dist
COPY --from=builder --chown=textverktyg:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=textverktyg:nodejs /app/package.json ./
COPY --from=builder --chown=textverktyg:nodejs /app/pnpm-lock.yaml ./
# Copy Prisma schema and migrations for deploy
COPY --from=builder --chown=textverktyg:nodejs /app/prisma ./prisma
# Copy public directory for static files
COPY --from=builder --chown=textverktyg:nodejs /app/public ./public
# Copy runtime prompt defaults (JSON)
COPY --from=builder --chown=textverktyg:nodejs /app/config ./config

# Copy entrypoint script
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Create directories with proper permissions
RUN mkdir -p data uploads && \
    chown -R textverktyg:nodejs data uploads && \
    chmod -R 755 data uploads

# Switch to non-root user
USER textverktyg

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Start the application
# Note: Environment variables are injected by Docker Compose, no --env-file needed
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/server.js"]
