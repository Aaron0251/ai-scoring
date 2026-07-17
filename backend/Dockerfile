FROM node:22-alpine

# Prisma 查詢引擎需要 openssl；同時套用最新安全更新
# （改用 Alpine 基底：Debian slim 有大量廠商標記 won't-fix 的 OS 層級 CVE，
#   Alpine 套件面積小且修補快，可通過 GCP 容器弱點掃描關卡）
RUN apk update && apk upgrade --no-cache && apk add --no-cache openssl

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
