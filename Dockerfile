# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY tsconfig.node.json ./
COPY index.html ./
COPY public public/
COPY src src/

# Install dependencies (including dev for build)
RUN npm install

# Build static assets
RUN npm run build

# Stage 2: Production
FROM node:22-alpine AS production

WORKDIR /app

# Install serve to serve static files
RUN npm install -g serve

# Copy built assets from builder
COPY --from=builder /app/dist ./dist

# Expose port (Vite dev server default, adjust for production)
EXPOSE 5173

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5173/ || exit 1

# Run serve to serve static files
CMD ["serve", "-s", "dist", "-l", "5173"]