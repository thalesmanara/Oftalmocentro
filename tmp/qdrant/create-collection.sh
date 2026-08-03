#!/bin/bash
set -euo pipefail
# Create Qdrant collection via temporary curl container on same network
docker run --rm --network vrv8r1yp224hzobdqqcenajo curlimages/curl:8.5.0 \
  -sS -X PUT "http://qdrant:6333/collections/oftalmocentro_chunks" \
  -H "Content-Type: application/json" \
  -d '{"vectors":{"size":1536,"distance":"Cosine"}}'
echo
docker run --rm --network vrv8r1yp224hzobdqqcenajo curlimages/curl:8.5.0 \
  -sS "http://qdrant:6333/collections/oftalmocentro_chunks"
echo
