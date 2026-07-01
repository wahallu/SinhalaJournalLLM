"""
SQLAlchemy ORM model for grammar correction records.
"""

import uuid
from datetime import datetime

from sqlalchemy import Text, DateTime, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class GrammarCorrection(Base):
    """Stores each grammar check request and its corrections."""

    __tablename__ = "grammar_corrections"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    original_text: Mapped[str] = mapped_column(Text, nullable=False)

    corrected_text: Mapped[str] = mapped_column(Text, nullable=False)

    # List of correction details: [{position, original, corrected, rule}, ...]
    corrections: Mapped[list] = mapped_column(JSONB, default=list)

    correction_count: Mapped[int] = mapped_column(default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    def __repr__(self) -> str:
        return (
            f"<GrammarCorrection id={self.id} "
            f"corrections={self.correction_count} "
            f"created_at={self.created_at}>"
        )
