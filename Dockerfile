# ---- Stage 1: Build ----
FROM node:20-slim AS builder

WORKDIR /app

# Install OpenSSL for Prisma client generation
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy application source code
COPY . .

# Generate Prisma client and build Next.js standalone
RUN npx prisma generate
RUN npm run build

# ---- Stage 2: Production Runner ----
FROM node:20-slim AS runner

WORKDIR /app

# Install OpenSSL for Prisma runtime
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=10000
ENV HOSTNAME="0.0.0.0"

# Copy Next.js standalone build and static assets
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

EXPOSE 10000

CMD ["node", "server.js"]

