from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import all models so Alembic autogenerate picks them up
from app.db.models import user, job  # noqa: F401, E402
