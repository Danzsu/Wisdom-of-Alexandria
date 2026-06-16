import uuid

from sqlalchemy import ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from alexandria_core.models.base import Base, Timestamps, UUIDPrimaryKey


class Project(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "projects"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str] = mapped_column(String(10), nullable=False, default="hu")

    books: Mapped[list["Book"]] = relationship(
        "Book", back_populates="project", cascade="all, delete-orphan"
    )
    series: Mapped[list["Series"]] = relationship(
        "Series", back_populates="project", cascade="all, delete-orphan"
    )
    characters: Mapped[list["Character"]] = relationship(
        "Character", back_populates="project", cascade="all, delete-orphan"
    )
    locations: Mapped[list["Location"]] = relationship(
        "Location", back_populates="project", cascade="all, delete-orphan"
    )
    worldbuilding_entries: Mapped[list["WorldbuildingEntry"]] = relationship(
        "WorldbuildingEntry", back_populates="project", cascade="all, delete-orphan"
    )
    codex_entries: Mapped[list["CodexEntry"]] = relationship(
        "CodexEntry", back_populates="project", cascade="all, delete-orphan"
    )
    snippets: Mapped[list["Snippet"]] = relationship(
        "Snippet", back_populates="project", cascade="all, delete-orphan"
    )
    style_guide: Mapped["StyleGuide | None"] = relationship(
        "StyleGuide", back_populates="project", uselist=False, cascade="all, delete-orphan"
    )
