FROM node:20-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./

# Install ALL dependencies (including devDeps) — needed for build tools
RUN npm ci && npm cache clean --force

COPY . .

# Build the app
RUN npm run build

# Remove devDependencies after build
RUN npm prune --omit=dev

EXPOSE 3000

# Regenerate Prisma client, sync DB schema, then start server
CMD ["sh", "-c", "echo '=== Starting ===' && npx prisma db push && echo '=== Prisma done ===' && echo '=== Running npm start ===' && npm run start 2>&1 || echo '=== START FAILED ===' && exit 1"]
