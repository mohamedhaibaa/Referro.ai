from fastapi import APIRouter, UploadFile, File

router = APIRouter()


@router.post("")
def upload_attachment(file: UploadFile = File(...)):
    # TODO: validate type/size, upload to blob storage, save metadata to DB
    return {"data": None, "meta": {}, "error": None}


@router.get("/files/{file_id}/download")
def get_download_url(file_id: str):
    # TODO: return pre-signed blob storage URL
    return {"data": {"url": None}, "meta": {}, "error": None}
