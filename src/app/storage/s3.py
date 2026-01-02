from __future__ import annotations

from typing import Dict, Optional

import boto3
from botocore.client import Config


class S3Storage:
    def __init__(
        self,
        bucket: str,
        endpoint_url: str,
        access_key: str,
        secret_key: str,
        region_name: str = "us-east-1",
    ) -> None:
        self.bucket = bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region_name,
            config=Config(signature_version="s3v4"),
        )
        self._ensure_bucket()

    def _ensure_bucket(self) -> None:
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except Exception:
            self.client.create_bucket(Bucket=self.bucket)

    def build_object_key(self, prefix: str, filename: str) -> str:
        prefix = prefix.strip("/")
        filename = filename.lstrip("/")
        return f"{prefix}/{filename}" if prefix else filename

    def upload_bytes(
        self,
        key: str,
        data: bytes,
        content_type: str,
        metadata: Optional[Dict[str, str]] = None,
    ) -> str:
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
            Metadata=metadata or {},
        )
        return key

    def object_metadata(self, key: str) -> Dict[str, object]:
        head = self.client.head_object(Bucket=self.bucket, Key=key)
        return {
            "content_type": head.get("ContentType"),
            "metadata": head.get("Metadata", {}),
        }

    def generate_presigned_url(self, key: str, expires_in: int = 300) -> str:
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expires_in,
        )
