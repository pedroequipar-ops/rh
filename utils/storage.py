import boto3
from botocore.client import Config
from django.conf import settings


class MinioStorage:
    """Upload/leitura passam pelo endpoint interno (rápido, dentro da rede
    Docker). URLs pré-assinadas usam o endpoint público, porque quem abre o
    link é o navegador do usuário, fora da rede da stack — se os dois
    endpoints forem iguais (dev), os clients apontam pro mesmo lugar."""

    def __init__(self):
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.MINIO_ENDPOINT,
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
            config=Config(signature_version="s3v4"),
        )
        self.public_client = boto3.client(
            "s3",
            endpoint_url=settings.MINIO_PUBLIC_ENDPOINT,
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
            config=Config(signature_version="s3v4"),
        )

    def upload_file(self, bucket: str, key: str, file_obj, content_type: str) -> str:
        self.client.upload_fileobj(
            file_obj,
            bucket,
            key,
            ExtraArgs={"ContentType": content_type},
        )
        return key

    def presigned_url(self, bucket: str, key: str, expires: int = 3600) -> str:
        return self.public_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=expires,
        )

    def presigned_put_url(
        self, bucket: str, key: str, content_type: str, expires: int = 900
    ) -> str:
        return self.public_client.generate_presigned_url(
            "put_object",
            Params={"Bucket": bucket, "Key": key, "ContentType": content_type},
            ExpiresIn=expires,
        )

    def head_object(self, bucket: str, key: str) -> bool:
        try:
            self.client.head_object(Bucket=bucket, Key=key)
            return True
        except Exception:
            return False

    def get_object(self, bucket: str, key: str) -> bytes:
        response = self.client.get_object(Bucket=bucket, Key=key)
        return response["Body"].read()
