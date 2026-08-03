FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

ENV PORT=8081 \
    TABULAR_WORK_DIR=/tmp/tabular-work \
    TABULAR_DOCS_ROOT=/home/node/files/documents \
    TABULAR_MAX_UPLOAD_BYTES=26214400 \
    TABULAR_MAX_SHEETS=50 \
    TABULAR_MAX_ROWS=50000 \
    TABULAR_MAX_COLUMNS=100 \
    TABULAR_ROWS_PER_CHUNK=25 \
    TABULAR_PREVIEW_ROWS=30 \
    TABULAR_TIMEOUT_SECONDS=120

RUN mkdir -p /tmp/tabular-work && chmod 777 /tmp/tabular-work

EXPOSE 8081

HEALTHCHECK --interval=15s --timeout=10s --retries=5 --start-period=15s \
  CMD wget -qO- http://127.0.0.1:8081/health || exit 1

CMD ["node", "server.js"]
