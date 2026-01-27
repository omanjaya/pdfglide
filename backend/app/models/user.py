"""User and subscription models for tier system."""

from datetime import datetime, date
from typing import Optional
import uuid

from sqlalchemy import Column, String, Integer, DateTime, Date, Boolean, BigInteger, Enum, ForeignKey
from sqlalchemy.orm import relationship
import enum

from app.models.database import Base


class UserTier(str, enum.Enum):
    """User subscription tiers."""
    FREE = "free"
    PRO = "pro"
    BUSINESS = "business"


class SubscriptionStatus(str, enum.Enum):
    """Subscription status."""
    ACTIVE = "active"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    PAST_DUE = "past_due"


class User(Base):
    """User model with subscription tier."""

    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    
    # Tier & subscription
    tier = Column(String(20), default=UserTier.FREE.value, nullable=False)
    
    # Profile
    name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login_at = Column(DateTime, nullable=True)
    
    # Relationships
    daily_usage = relationship("DailyUsage", back_populates="user", cascade="all, delete-orphan")
    subscription = relationship("Subscription", back_populates="user", uselist=False)

    def __repr__(self):
        return f"<User {self.email} ({self.tier})>"


class Subscription(Base):
    """Subscription model for paid plans."""

    __tablename__ = "subscriptions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    # Plan details
    plan = Column(String(20), nullable=False)  # 'pro', 'business'
    status = Column(String(20), default=SubscriptionStatus.ACTIVE.value)
    
    # Payment provider
    stripe_customer_id = Column(String(255), nullable=True)
    stripe_subscription_id = Column(String(255), nullable=True)
    
    # Billing period
    current_period_start = Column(DateTime, nullable=True)
    current_period_end = Column(DateTime, nullable=True)
    
    # Cancellation
    cancel_at_period_end = Column(Boolean, default=False)
    cancelled_at = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="subscription")

    def is_active(self) -> bool:
        """Check if subscription is currently active."""
        if self.status != SubscriptionStatus.ACTIVE.value:
            return False
        if self.current_period_end and self.current_period_end < datetime.utcnow():
            return False
        return True


class DailyUsage(Base):
    """Daily usage tracking per user."""

    __tablename__ = "daily_usage"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False, default=date.today)
    
    # Counters
    files_processed = Column(Integer, default=0)
    bytes_processed = Column(BigInteger, default=0)
    
    # Breakdown by tool type (optional, for analytics)
    pdf_operations = Column(Integer, default=0)
    image_operations = Column(Integer, default=0)
    document_operations = Column(Integer, default=0)
    
    # Relationships
    user = relationship("User", back_populates="daily_usage")

    class Meta:
        unique_together = ('user_id', 'date')

    def __repr__(self):
        return f"<DailyUsage {self.user_id} @ {self.date}: {self.files_processed} files>"


# Anonymous user tracking (for users without accounts)
class AnonymousUsage(Base):
    """Track usage for anonymous users by IP hash."""

    __tablename__ = "anonymous_usage"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ip_hash = Column(String(64), nullable=False, index=True)  # Hashed IP for privacy
    date = Column(Date, nullable=False, default=date.today)
    
    # Counters
    files_processed = Column(Integer, default=0)
    bytes_processed = Column(BigInteger, default=0)

    class Meta:
        unique_together = ('ip_hash', 'date')
