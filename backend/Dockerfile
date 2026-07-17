FROM node:22-slim

# Prisma 需要 openssl；同時套用最新安全更新
RUN apt-get update -y && apt-get upgrade -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev \
  # 移除 npm CLI 本身（其內建的 tar/sigstore/ip-address/picomatch 等套件常帶有 CVE，
  # 執行期只需要 node 執行 start.sh，不需要 npm/npx，移除可消除這些誤報漏洞來源）
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

COPY . .

# Cloud Run 預設注入 PORT=8080
ENV PORT=8080
EXPOSE 8080

# 啟動時自動執行 Migration 再啟動 Server
COPY start.sh /start.sh
RUN chmod +x /start.sh
CMD ["/start.sh"]
