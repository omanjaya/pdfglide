"""Usage tracking and limit enforcement middleware."""

from datetime import date
from typing import Optional

from fastapi import Request, HTTPException, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import DailyUsage, AnonymousUsage, User
from app.core.auth import hash_ip, get_tier_limits, decode_token


async def get_user_from_request(request: Request, db: AsyncSession) -> Optional[User]:
    """Extract user from request if authenticated."""
    auth_header = request.headers.get("Authorization")
    
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    
    token = auth_header.split(" ")[1]
    payload = decode_token(token)
    
    if not payload or payload.get("type") != "access":
        return None
    
    user_id = payload.get("sub")
    if not user_id:
        return None
    
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_daily_usage(user: User, db: AsyncSession) -> DailyUsage:
    """Get or create daily usage record for a user."""
    today = date.today()
    
    result = await db.execute(
        select(DailyUsage).where(
            and_(
                DailyUsage.user_id == user.id,
                DailyUsage.date == today
            )
        )
    )
    usage = result.scalar_one_or_none()
    
    if not usage:
        usage = DailyUsage(user_id=user.id, date=today)
        db.add(usage)
        await db.commit()
        await db.refresh(usage)
    
    return usage


async def get_anonymous_usage(ip_hash: str, db: AsyncSession) -> AnonymousUsage:
    """Get or create daily usage record for anonymous user."""
    today = date.today()
    
    result = await db.execute(
        select(AnonymousUsage).where(
            and_(
                AnonymousUsage.ip_hash == ip_hash,
                AnonymousUsage.date == today
            )
        )
    )
    usage = result.scalar_one_or_none()
    
    if not usage:
        usage = AnonymousUsage(ip_hash=ip_hash, date=today)
        db.add(usage)
        await db.commit()
        await db.refresh(usage)
    
    return usage


async def check_usage_limits(
    request: Request,
    db: AsyncSession,
    file_size: int = 0,
) -> dict:
    """
    Check if the user/anonymous user has exceeded their usage limits.
    
    Returns:
        dict with tier info and whether limits are exceeded
    
    Raises:
        HTTPException if limits are exceeded
    """
    user = await get_user_from_request(request, db)
    
    if user:
        # Authenticated user
        limits = get_tier_limits(user.tier)
        usage = await get_daily_usage(user, db)
        
        # Check daily file limit
        if limits["daily_file_limit"] != -1:  # -1 = unlimited
            if usage.files_processed >= limits["daily_file_limit"]:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail={
                        "error": "Daily file limit exceeded",
                        "limit": limits["daily_file_limit"],
                        "used": usage.files_processed,
                        "upgrade_url": "/pricing",
                        "message": f"You've reached your daily limit of {limits['daily_file_limit']} files. Upgrade to Pro for unlimited access.",
                    }
                )
        
        # Check file size limit
        if file_size > limits["max_file_size"]:
            max_mb = limits["max_file_size"] / (1024 * 1024)
            file_mb = file_size / (1024 * 1024)
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail={
                    "error": "File size exceeds limit",
                    "max_size_mb": max_mb,
                    "file_size_mb": round(file_mb, 2),
                    "upgrade_url": "/pricing",
                    "message": f"File size ({file_mb:.1f}MB) exceeds your limit of {max_mb:.0f}MB. Upgrade for larger files.",
                }
            )
        
        return {
            "authenticated": True,
            "user_id": user.id,
            "tier": user.tier,
            "usage": usage,
            "limits": limits,
        }
    
    else:
        # Anonymous user
        client_ip = request.client.host if request.client else "unknown"
        ip_hash = hash_ip(client_ip)
        
        limits = get_tier_limits("anonymous")
        usage = await get_anonymous_usage(ip_hash, db)
        
        # Check daily file limit
        if usage.files_processed >= limits["daily_file_limit"]:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "error": "Daily file limit exceeded",
                    "limit": limits["daily_file_limit"],
                    "used": usage.files_processed,
                    "register_url": "/register",
                    "message": f"You've reached the limit of {limits['daily_file_limit']} files. Create a free account for more!",
                }
            )
        
        # Check file size limit
        if file_size > limits["max_file_size"]:
            max_mb = limits["max_file_size"] / (1024 * 1024)
            file_mb = file_size / (1024 * 1024)
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail={
                    "error": "File size exceeds limit",
                    "max_size_mb": max_mb,
                    "file_size_mb": round(file_mb, 2),
                    "register_url": "/register",
                    "message": f"File size ({file_mb:.1f}MB) exceeds the limit of {max_mb:.0f}MB. Create an account for larger files!",
                }
            )
        
        return {
            "authenticated": False,
            "ip_hash": ip_hash,
            "tier": "anonymous",
            "usage": usage,
            "limits": limits,
        }


async def increment_usage(
    request: Request,
    db: AsyncSession,
    bytes_processed: int = 0,
    tool_type: str = "other",
) -> None:
    """Increment usage counters after successful processing."""
    user = await get_user_from_request(request, db)
    
    if user:
        usage = await get_daily_usage(user, db)
    else:
        client_ip = request.client.host if request.client else "unknown"
        ip_hash = hash_ip(client_ip)
        usage = await get_anonymous_usage(ip_hash, db)
    
    # Increment counters
    usage.files_processed += 1
    usage.bytes_processed += bytes_processed
    
    # Increment tool-specific counter if DailyUsage (has tool breakdown)
    if hasattr(usage, 'pdf_operations'):
        if tool_type.startswith("pdf"):
            usage.pdf_operations += 1
        elif tool_type.startswith("image"):
            usage.image_operations += 1
        elif tool_type.startswith("document"):
            usage.document_operations += 1
    
    await db.commit()
