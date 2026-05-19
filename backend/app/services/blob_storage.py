"""REF-33a: Azure Blob Storage client.

Replaces the worker/app/integrations/blob_storage.py stub that
raised NotImplementedError. The worker stub remains as a re-export
shim for any defensive imports there (grep showed no callers).

Uses the connection-string credential pattern (Q1 locked).
BLOB_STORAGE_CONNECTION_STRING is in .env, verified against Azure
prod during plan-phase.
"""
import logging
from typing import Optional

from azure.storage.blob import BlobServiceClient, ContentSettings

from app.core.config import settings

logger = logging.getLogger(__name__)


class BlobStorageClient:
    """Lazy singleton over BlobServiceClient.

    Initialization is deferred until first call so importing this
    module doesn't crash when BLOB_STORAGE_CONNECTION_STRING is
    unset (e.g. in CI environments or worker contexts that don't
    use blob storage).
    """

    def __init__(self) -> None:
        self._service: Optional[BlobServiceClient] = None

    def _get_service(self) -> BlobServiceClient:
        if self._service is None:
            conn = settings.BLOB_STORAGE_CONNECTION_STRING
            if not conn:
                raise RuntimeError(
                    "BLOB_STORAGE_CONNECTION_STRING is not set. "
                    "Add the Azure Blob connection string to .env."
                )
            self._service = BlobServiceClient.from_connection_string(conn)
        return self._service

    def upload(
        self,
        container: str,
        blob_path: str,
        content: bytes,
        content_type: str = "application/octet-stream",
    ) -> str:
        """Upload bytes to a blob. Overwrites if exists. Returns blob_path."""
        client = self._get_service().get_blob_client(container=container, blob=blob_path)
        client.upload_blob(
            content,
            overwrite=True,
            content_settings=ContentSettings(content_type=content_type),
        )
        return blob_path

    def download(self, container: str, blob_path: str) -> bytes:
        """Download a blob as bytes."""
        client = self._get_service().get_blob_client(container=container, blob=blob_path)
        return client.download_blob().readall()

    def delete(self, container: str, blob_path: str) -> None:
        """Delete a blob. Includes any snapshots."""
        client = self._get_service().get_blob_client(container=container, blob=blob_path)
        client.delete_blob(delete_snapshots="include")


blob_storage = BlobStorageClient()
