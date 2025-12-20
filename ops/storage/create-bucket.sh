#!/usr/bin/env sh
set -eu

until mc alias set local http://storage:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" 2>/dev/null; do
  echo "Waiting for storage service..."
  sleep 2
done

mc mb --ignore-existing local/${S3_BUCKET}
mc anonymous set download local/${S3_BUCKET}
