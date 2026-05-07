FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY .npmrc ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY tsconfig.node.json ./
COPY tsconfig.app.json ./
COPY tsconfig.server.json ./
COPY index.html ./
COPY public public/
COPY src src/
COPY server/ ./server/
COPY jest.config.cjs ./
COPY jest.setup.ts ./
COPY tests/ ./tests/
COPY tsconfig.jest.json ./

RUN npm install --legacy-peer-deps

RUN npm run build

FROM node:22-alpine

WORKDIR /app

RUN mkdir -p /app/db

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server ./server
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3001

CMD ["npx", "tsx", "server/index.ts"]