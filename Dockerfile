# Backend API image – skeleton (will be refined with multi-stage build)
FROM node:20-bookworm-slim AS base
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
COPY tests/fixtures ./tests/fixtures

RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "dist/server.js"]
