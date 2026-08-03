#!/usr/bin/env python3
"""Inject Qdrant service into Coolify compose (idempotent)."""
from pathlib import Path

COMPOSE = Path("/data/coolify/services/vrv8r1yp224hzobdqqcenajo/docker-compose.yml")
text = COMPOSE.read_text()

if "qdrant-vrv8r1yp224hzobdqqcenajo" in text or "\n  qdrant:\n" in text:
    print("QDRANT_ALREADY_IN_COMPOSE")
    raise SystemExit(0)

QDRANT_SERVICE = '''
  qdrant:
    image: qdrant/qdrant:v1.13.4
    container_name: qdrant-vrv8r1yp224hzobdqqcenajo
    restart: unless-stopped
    expose:
      - "6333"
      - "6334"
    volumes:
      - "vrv8r1yp224hzobdqqcenajo_qdrant-data:/qdrant/storage"
    environment:
      QDRANT__SERVICE__HTTP_PORT: "6333"
      QDRANT__SERVICE__GRPC_PORT: "6334"
      COOLIFY_RESOURCE_UUID: vrv8r1yp224hzobdqqcenajo
      COOLIFY_CONTAINER_NAME: qdrant-vrv8r1yp224hzobdqqcenajo
      SERVICE_NAME_QDRANT: qdrant
      SERVICE_NAME_N8N: n8n
      SERVICE_NAME_POSTGRESQL: postgresql
    mem_limit: 1024m
    cpus: 1.0
    healthcheck:
      test:
        - CMD-SHELL
        - "bash -c 'exec 3<>/dev/tcp/127.0.0.1/6333'"
      interval: 15s
      timeout: 10s
      retries: 10
      start_period: 20s
    labels:
      - coolify.managed=true
      - coolify.version=4.1.1
      - coolify.serviceId=2
      - coolify.type=service
      - coolify.name=qdrant-vrv8r1yp224hzobdqqcenajo
      - coolify.resourceName=n8n-with-postgresql-vrv8r1yp224hzobdqqcenajo
      - coolify.projectName=oftalmocentro
      - coolify.serviceName=qdrant
      - coolify.environmentName=production
      - coolify.pullRequestId=0
      - coolify.service.subId=9
      - coolify.service.subType=application
      - coolify.service.subName=qdrant
      - traefik.enable=false
    networks:
      vrv8r1yp224hzobdqqcenajo: null
    env_file:
      - .env

'''

VOLUME_LINE = "  vrv8r1yp224hzobdqqcenajo_qdrant-data:\n    name: vrv8r1yp224hzobdqqcenajo_qdrant-data\n"

if "volumes:" not in text:
    raise SystemExit("NO_VOLUMES_SECTION")

# Insert service before volumes:
marker = "\nvolumes:\n"
idx = text.rfind(marker)
if idx < 0:
    raise SystemExit("VOLUMES_MARKER_NOT_FOUND")

text = text[:idx] + "\n" + QDRANT_SERVICE + text[idx:]

# Insert volume definition before networks or at end of volumes
vol_marker = "  vrv8r1yp224hzobdqqcenajo_tabular-tmp:\n    name: vrv8r1yp224hzobdqqcenajo_tabular-tmp\n"
if vol_marker in text and "vrv8r1yp224hzobdqqcenajo_qdrant-data" not in text:
    text = text.replace(vol_marker, vol_marker + VOLUME_LINE)
elif "vrv8r1yp224hzobdqqcenajo_qdrant-data" not in text:
    # fallback: before networks
    net = "\nnetworks:\n"
    nidx = text.rfind(net)
    if nidx < 0:
        raise SystemExit("NETWORKS_NOT_FOUND")
    text = text[:nidx] + VOLUME_LINE + text[nidx:]

COMPOSE.write_text(text)
print("QDRANT_COMPOSE_PATCHED")
