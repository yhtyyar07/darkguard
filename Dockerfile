FROM node:22-alpine AS builder

WORKDIR /app

ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source
COPY . .

# Build Next.js app
RUN npm run build

# Production image
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copy from builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Install curl for healthcheck
RUN apk add --no-cache curl

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

EXPOSE 3000

CMD ["node", "server.js"]
