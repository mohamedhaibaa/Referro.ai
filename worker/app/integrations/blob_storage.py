from azure.storage.blob import BlobServiceClient
from app.core.config import settings


class BlobStorageClient:
    """Client for Azure Blob Storage."""

    def __init__(self):
        self.account = settings.BLOB_STORAGE_ACCOUNT

    def upload(self, container: str, blob_path: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        """
        Upload data to blob storage.

        Returns:
            Full blob URL
        """
        # TODO: implement upload using azure-storage-blob SDK
        raise NotImplementedError("Blob upload not yet implemented")


blob_storage = BlobStorageClient()
