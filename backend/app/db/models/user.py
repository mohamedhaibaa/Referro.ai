import uuid
from decimal import Decimal
from sqlalchemy import ForeignKey, Integer, String, Text, Index, Numeric
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime, timezone
from app.db.base import Base


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    credits_remaining: Mapped[Decimal] = mapped_column(Numeric(precision=6, scale=1), nullable=False, default=Decimal("0.0"))
    credits_total: Mapped[Decimal] = mapped_column(Numeric(precision=6, scale=1), nullable=False, default=Decimal("0.0"))
    plan_tier: Mapped[str] = mapped_column(String(20), nullable=False, default="trial")
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)

    __table_args__ = (
        Index("users_email_idx", "email"),
    )


class UserProfile(Base):
    """REF-33a: parsed resume data + raw blob reference.

    One-to-one with User (unique constraint on user_id). Populated
    when user uploads a resume via POST /api/v1/profile/resume.
    UserContext.is_thin() is True until this row exists — REF-32
    fallback path (the prompt's §3 thin-context branch) handles
    that case.

    parse_raw_response: full AI response for offline prompt-quality
    evaluation (mirrors REF-30 ContactReply.raw_ai_response).
    user_edited_fields: list of field names the user manually
    overrode after parse. Preserved across re-uploads — see
    POST /api/v1/profile/resume UPSERT semantics.

    DELETE /api/v1/profile/resume drops the row entirely (DQ-F /
    Q2 — row exists ↔ user has resume data).
    """
    __tablename__ = "user_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    # Raw resume reference
    resume_blob_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    resume_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    resume_uploaded_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # Parsed structured fields (mirror UserContext v2 shape)
    skills: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    experience_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    experience_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    education: Mapped[str | None] = mapped_column(Text, nullable=True)
    job_titles_history: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    # DQ-C: REF-33a does NOT extract these. Columns provisioned so a
    # future onboarding-question ticket adds them without a migration.
    target_roles: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    target_companies: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    raw_resume_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Audit / eval
    parse_raw_response: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    user_edited_fields: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)

    __table_args__ = (
        Index("user_profiles_user_id_idx", "user_id"),
    )
