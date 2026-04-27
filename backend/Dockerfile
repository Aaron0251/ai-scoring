FROM node:22-slim

# Prisma 需要 openssl
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev

COPY . .

# Cloud Run 預設注入 PORT=8080
ENV PORT=8080
EXPOSE 8080

# 啟動時自動執行 Migration 再啟動 Server
COPY start.sh /start.sh
RUN chmod +x /start.sh
CMD ["/start.sh"]
