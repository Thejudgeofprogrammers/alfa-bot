FROM node:20-alpine3.20 AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .
RUN npm run build

FROM node:20-alpine3.20

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist 
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/jsons ./jsons


CMD ["node", "/app/dist/main.js"]