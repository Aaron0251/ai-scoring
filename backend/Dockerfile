FROM node:22-slim

# Prisma 需要 openssl
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN npx prisma generate

# Cloud Run 預設注入 PORT=8080
ENV PORT=8080
EXPOSE 8080

CMD ["node", "src/index.js"]
