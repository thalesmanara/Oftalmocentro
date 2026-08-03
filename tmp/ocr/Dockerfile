FROM jbarlow83/ocrmypdf:v16.10.1

USER root

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    tesseract-ocr-por \
    tesseract-ocr-eng \
    python3-pip \
    curl \
  && pip3 install --no-cache-dir --break-system-packages --ignore-installed \
    flask gunicorn \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY app.py /app/app.py

ENV OCR_LANGUAGES=por+eng \
    OCR_TIMEOUT_SECONDS=180 \
    OCR_WORK_DIR=/tmp/ocr-work \
    PORT=8080

RUN mkdir -p /tmp/ocr-work && chmod 777 /tmp/ocr-work

EXPOSE 8080

# base image ENTRYPOINT is ocrmypdf — clear it so gunicorn runs
ENTRYPOINT []

HEALTHCHECK --interval=15s --timeout=10s --retries=5 --start-period=20s \
  CMD curl -fsS http://127.0.0.1:8080/health || exit 1

# single worker: 1 CPU host
CMD ["gunicorn", "-b", "0.0.0.0:8080", "-t", "300", "--workers", "1", "--threads", "1", "app:app"]
