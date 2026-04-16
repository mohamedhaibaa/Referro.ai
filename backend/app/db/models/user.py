import uuid
from decimal import Decimal
from sqlalchemy import String, Text, Index, Numeric
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
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
