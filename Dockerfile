FROM node:22-alpine

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

RUN npm install --legacy-peer-deps

RUN npm run build

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/ || exit 1

CMD ["npx", "tsx", "server/index.ts"]