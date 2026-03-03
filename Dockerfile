FROM node:20-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./

RUN npm ci && npm cache clean --force

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx prisma generate && npx prisma db push && echo '=== Starting server ===' && echo 'Contents of build/server:' && ls -la build/server/ && echo 'Start script:' && node -e \"const p=require('./package.json'); console.log(p.scripts.start)\" && echo 'Checking serve binary:' && npx react-router-serve --help 2>&1 | head -3 || echo 'react-router-serve NOT FOUND' && echo '=== Running npm start ===' && npm run start 2>&1"]
