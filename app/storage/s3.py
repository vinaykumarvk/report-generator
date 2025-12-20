from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Mapping, MutableMapping
from uuid import uuid4

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError


def _generate_object_name(prefix: str, filename: str) -> str:
    prefix = prefix.strip("/")
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    unique = uuid4().hex
    safe_name = filename.lstrip("/")
    return f"{prefix}/{timestamp}-{unique}-{safe_name}"


@dataclass
class S3Storage:
    """
    Minimal S3 wrapper that works with S3-compatible endpoints (e.g., MinIO).
    Handles bucket creation, uploads, metadata, and presigned URLs.
    """

    bucket: str
    endpoint_url: str | None = None
    region_name: str = "us-east-1"
    access_key: str | None = None
    secret_key: str | None = None
    default_acl: str = "private"
    addressing_style: str = "path"
    client: boto3.client = field(init=False, repr=False)

    def __post_init__(self) -> None:
        config = Config(
            signature_version="s3v4",
            s3={"addressing_style": self.addressing_style},
        )
        session = boto3.session.Session()
        self.client = session.client(
            "s3",
            endpoint_url=self.endpoint_url,
            region_name=self.region_name,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            config=config,
        )
        self._ensure_bucket()

    def build_object_key(self, prefix: str, filename: str) -> str:
        return _generate_object_name(prefix, filename)

    def _ensure_bucket(self) -> None:
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except ClientError as exc:  # pragma: no cover - defensive path
            error_code = str(exc.response.get("Error", {}).get("Code", ""))
            if error_code in {"404", "NoSuchBucket", "NotFound"}:
                params: MutableMapping[str, object] = {"Bucket": self.bucket}
                if self.region_name and self.region_name != "us-east-1":
                    params["CreateBucketConfiguration"] = {"LocationConstraint": self.region_name}
                self.client.create_bucket(**params)
            elif error_code in {"301", "403"}:
                # Bucket exists but is not accessible with current credentials.
                # This is acceptable for callers that do not require creation.
                return
            else:
                raise

    def upload_bytes(
        self,
        key: str,
        data: bytes,
        *,
        content_type: str,
        metadata: Mapping[str, str] | None = None,
    ) -> str:
        extras: MutableMapping[str, object] = {
            "Bucket": self.bucket,
            "Key": key,
            "Body": data,
            "ContentType": content_type,
            "ACL": self.default_acl,
        }
        if metadata:
            extras["Metadata"] = {k: str(v) for k, v in metadata.items()}

        self.client.put_object(**extras)
        return key

    def generate_presigned_url(self, key: str, *, expires_in: int = 3600, method: str = "get_object") -> str:
        return self.client.generate_presigned_url(
            ClientMethod=method,
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expires_in,
        )

    def object_metadata(self, key: str) -> dict:
        response = self.client.head_object(Bucket=self.bucket, Key=key)
        return {
            "content_type": response.get("ContentType"),
            "metadata": response.get("Metadata", {}),
            "content_length": response.get("ContentLength"),
        }
