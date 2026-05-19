"""REF-33a: profile endpoints (resume upload + parsed-field CRUD).

Routes:
  POST   /api/v1/profile/resume     — upload + parse + UPSERT
  GET    /api/v1/profile            — read user_profile (thin envelope if none)
  PATCH  /api/v1/profile            — edit individual fields (manual override)
  DELETE /api/v1/profile/resume     — hard delete (blob + row)

Auth: all routes require a valid JWT (get_current_user dep).
Response envelope: matches the project-wide
{ data, meta, error } shape per CLAUDE.md §5.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.models.user import User, UserProfile
from app.db.session import get_db
from app.services.blob_storage import blob_storage
from app.services.ref_ai import parse_resume
from app.services.resume_extraction import extract_text

logger = logging.getLogger(__name__)

router = APIRouter()

ALLOWED_MIME = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
EXT_BY_MIME = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}
MAX_FILE_BYTES = 5 * 1024 * 1024  # 5 MB
# Fields the AI parses + manual editor touches. user_edited_fields
# only tracks names from this set.
PARSED_FIELDS = (
    "skills", "experience_years", "experience_summary",
    "education", "job_titles_history",
    "target_roles", "target_companies",
)


# --- Pydantic models ---

class ProfileData(BaseModel):
    user_id: str
    resume_filename: Optional[str] = None
    resume_uploaded_at: Optional[datetime] = None
    skills: list[str] = []
    experience_years: Optional[int] = None
    experience_summary: str = ""
    education: str = ""
    job_titles_history: list[str] = []
    target_roles: list[str] = []
    target_companies: list[str] = []
    user_edited_fields: list[str] = []
    is_thin: bool = True


class UploadResumeMeta(BaseModel):
    overwrote_user_edits: list[str] = []
    parse_failed: bool = False


class ProfilePatch(BaseModel):
    skills: Optional[list[str]] = None
    experience_years: Optional[int] = None
    experience_summary: Optional[str] = None
    education: Optional[str] = None
    job_titles_history: Optional[list[str]] = None
    # DQ-C: target_roles / target_companies aren't AI-parsed in REF-33a,
    # but per Q3 PATCH still accepts them so users can populate manually.
    target_roles: Optional[list[str]] = None
    target_companies: Optional[list[str]] = None


# --- Serializers ---

def _profile_to_data(profile: UserProfile) -> ProfileData:
    populated = any([
        profile.skills, profile.experience_years,
        profile.experience_summary, profile.education,
        profile.job_titles_history, profile.target_roles,
        profile.target_companies, profile.raw_resume_text,
    ])
    return ProfileData(
        user_id=str(profile.user_id),
        resume_filename=profile.resume_filename,
        resume_uploaded_at=profile.resume_uploaded_at,
        skills=profile.skills or [],
        experience_years=profile.experience_years,
        experience_summary=profile.experience_summary or "",
        education=profile.education or "",
        job_titles_history=profile.job_titles_history or [],
        target_roles=profile.target_roles or [],
        target_companies=profile.target_companies or [],
        user_edited_fields=profile.user_edited_fields or [],
        is_thin=not populated,
    )


def _empty_profile_data(user_id: uuid.UUID) -> ProfileData:
    return ProfileData(user_id=str(user_id), is_thin=True)


# --- Endpoints ---

@router.post("/resume", status_code=status.HTTP_201_CREATED)
def upload_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """REF-33a: upload + parse + UPSERT. Re-upload deletes the old
    blob and preserves manually-edited fields (DQ-K).

    Q4: parse_failed=true returns 201 with empty fields — the blob
    is still saved, the user can PATCH manually via settings.
    """
    # Validate
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {file.content_type!r}. Use PDF or DOCX.",
        )
    content = file.file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large: {len(content)} bytes (max {MAX_FILE_BYTES})",
        )

    # Upload to blob
    ext = EXT_BY_MIME[file.content_type]
    blob_path = f"{current_user.id}/{uuid.uuid4()}{ext}"
    try:
        blob_storage.upload(
            settings.BLOB_STORAGE_CONTAINER_RESUMES,
            blob_path, content, content_type=file.content_type,
        )
    except Exception:
        logger.exception("Blob upload failed for user=%s", current_user.id)
        raise HTTPException(status_code=500, detail="Failed to store resume")

    # Extract + parse.
    # REF-33b Bug B fix: extract_text now returns (text, error_info).
    # When extraction throws (e.g. transient python-docx flake), the
    # exception details land in parsed["raw_ai_response"] under
    # "_extraction_error" so a future debug can query user_profiles
    # for the failure cause. parse_resume itself is unchanged — it
    # still returns _empty_parse_result on empty input.
    raw_text, extract_error = extract_text(file.filename or f"resume{ext}", content)
    parsed = parse_resume(raw_text)
    if extract_error is not None:
        # Replace whatever parse_resume put in raw_ai_response (None for
        # the empty-input early return) with the extraction error info.
        # Future-self debugging surface: query
        #   SELECT user_id, parse_raw_response FROM user_profiles
        #   WHERE parse_raw_response ? '_extraction_error';
        parsed["raw_ai_response"] = {"_extraction_error": extract_error}
    parse_failed = not any([
        parsed["skills"], parsed["experience_years"],
        parsed["experience_summary"], parsed["education"],
        parsed["job_titles_history"],
    ])

    # UPSERT — preserve manually-edited fields per DQ-K
    existing = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    overwrote: list[str] = []
    if existing is None:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)
    else:
        profile = existing
        if existing.resume_blob_path:
            try:
                blob_storage.delete(
                    settings.BLOB_STORAGE_CONTAINER_RESUMES,
                    existing.resume_blob_path,
                )
            except Exception:
                # Orphan blob beats stuck delete — log + continue.
                logger.exception(
                    "Old blob delete failed (continuing): %s", existing.resume_blob_path,
                )
        # Per DQ-K: fields the user has manually edited are PRESERVED
        # across re-upload. Surface that to the frontend so it can show
        # "we kept your manual edits to: X, Y, Z" in the confirmation UX.
        overwrote = list(existing.user_edited_fields or [])

    profile.resume_blob_path = blob_path
    profile.resume_filename = file.filename
    profile.resume_uploaded_at = datetime.now(timezone.utc)
    profile.raw_resume_text = raw_text
    profile.parse_raw_response = parsed["raw_ai_response"]

    edited = set(profile.user_edited_fields or [])
    for fld in ("skills", "experience_years", "experience_summary",
                "education", "job_titles_history"):
        if fld in edited:
            continue  # preserve manual edit
        setattr(profile, fld, parsed[fld])

    db.commit()
    db.refresh(profile)

    return {
        "data": _profile_to_data(profile).model_dump(),
        "meta": UploadResumeMeta(
            overwrote_user_edits=overwrote,
            parse_failed=parse_failed,
        ).model_dump(),
        "error": None,
    }


@router.get("")
def get_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """REF-33a: returns thin envelope (is_thin=True) when no profile
    row exists. Frontend always has data — no 404 to handle."""
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if profile is None:
        return {
            "data": _empty_profile_data(current_user.id).model_dump(),
            "meta": {},
            "error": None,
        }
    return {
        "data": _profile_to_data(profile).model_dump(),
        "meta": {},
        "error": None,
    }


@router.patch("")
def patch_profile(
    body: ProfilePatch,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """REF-33a: manual override. Fields touched here are added to
    user_edited_fields so a subsequent re-upload preserves them
    (DQ-K). Accepts any field in PARSED_FIELDS — including
    target_roles / target_companies which the AI parser doesn't
    populate but users can fill manually (Q3)."""
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if profile is None:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)
        db.flush()

    patch = body.model_dump(exclude_unset=True)
    if not patch:
        raise HTTPException(status_code=400, detail="Empty patch body")

    edited = set(profile.user_edited_fields or [])
    for fld, val in patch.items():
        if fld not in PARSED_FIELDS:
            continue  # defensive — Pydantic Literal would have caught
        setattr(profile, fld, val)
        edited.add(fld)
    profile.user_edited_fields = sorted(edited)

    db.commit()
    db.refresh(profile)
    return {
        "data": _profile_to_data(profile).model_dump(),
        "meta": {},
        "error": None,
    }


@router.delete("/resume", status_code=status.HTTP_204_NO_CONTENT)
def delete_resume(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """REF-33a (DQ-F / Q2): hard delete — blob + entire row.
    Row exists ↔ user has resume data. Idempotent: 204 even when
    no row exists."""
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if profile is None:
        return  # 204 idempotent

    if profile.resume_blob_path:
        try:
            blob_storage.delete(
                settings.BLOB_STORAGE_CONTAINER_RESUMES,
                profile.resume_blob_path,
            )
        except Exception:
            logger.exception(
                "Blob delete failed for user=%s path=%s; continuing with DB delete",
                current_user.id, profile.resume_blob_path,
            )

    db.delete(profile)
    db.commit()
    return
