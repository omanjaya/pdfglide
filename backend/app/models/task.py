"""Task and file models."""

from datetime import datetime
from typing import Optional

from sqlalchemy import Column, String, Integer, DateTime, JSON, ForeignKey, Text
from sqlalchemy.orm import relationship

from app.models.database import Base


class Task(Base):
    """Task model for tracking file processing jobs."""

    __tablename__ = "tasks"

    id = Column(String, primary_key=True)
    tool_type = Column(String, nullable=False)
    status = Column(String, nullable=False, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    task_metadata = Column(JSON, nullable=True)

    input_files = relationship(
        "InputFile", back_populates="task", cascade="all, delete-orphan"
    )
    output_files = relationship(
        "OutputFile", back_populates="task", cascade="all, delete-orphan"
    )


class InputFile(Base):
    """Input file model."""

    __tablename__ = "input_files"

    id = Column(String, primary_key=True)
    task_id = Column(
        String, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    original_name = Column(String, nullable=False)
    stored_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String, nullable=False)
    upload_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("Task", back_populates="input_files")


class OutputFile(Base):
    """Output file model."""

    __tablename__ = "output_files"

    id = Column(String, primary_key=True)
    task_id = Column(
        String, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String, nullable=False)
    download_count = Column(Integer, default=0)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("Task", back_populates="output_files")


class UsageStats(Base):
    """Usage statistics model."""

    __tablename__ = "usage_stats"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tool_type = Column(String, nullable=False)
    input_size = Column(Integer, nullable=False)
    output_size = Column(Integer, nullable=False)
    processing_time_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    """Audit log model for GDPR compliance - tracks data access and processing."""

    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_type = Column(String, nullable=False)  # upload, download, delete, process
    task_id = Column(String, nullable=True)
    file_id = Column(String, nullable=True)
    client_ip = Column(String, nullable=True)  # Hashed for privacy
    user_agent = Column(String, nullable=True)
    details = Column(JSON, nullable=True)  # Additional metadata
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
