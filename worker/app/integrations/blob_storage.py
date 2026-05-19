"""REF-33a: re-export shim.

Real implementation moved to backend/app/services/blob_storage.py.
Kept here so any defensive imports from worker code don't break.
Grep at REF-33a time showed no callers in worker — this shim is
purely backward-compat insurance.
"""
from app.services.blob_storage import BlobStorageClient, blob_storage  # noqa: F401
