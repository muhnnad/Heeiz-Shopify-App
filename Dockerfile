FROM node:20-alpine
RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./

# Install ALL dependencies (including devDeps) — needed for build tools (vite, @react-router/dev)
RUN npm ci && npm cache clean --force

COPY . .

# Build the app (requires devDependencies)
RUN npm run build

# Remove devDependencies after build to keep the image slim
RUN npm prune --omit=dev

EXPOSE 3000

# Run schema sync then start the server
CMD ["sh", "-c", "npx prisma db push && npm run start"]
