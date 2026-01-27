"""
Redis-based rate limiting for distributed API servers.

This replaces the in-memory rate limiter when running multiple API instances.
Rate limit state is shared across all instances via Redis.
"""

import time
import ipaddress
from dataclasses import dataclass, field
from typing import Optional, Set, Tuple

from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.logging import get_logger
from app.config import settings

logger = get_logger(__name__)


@dataclass
class RedisRateLimitConfig:
    """Configuration for Redis-based rate limiting."""
    requests_per_minute: int = 60
    requests_per_hour: int = 1000
    burst_limit: int = 10
    trusted_proxies: Set[str] = field(default_factory=lambda: {
        "127.0.0.1",
        "::1",
        "10.0.0.0/8",
        "172.16.0.0/12",
        "192.168.0.0/16",
    })


class RedisRateLimiter:
    """
    Redis-based rate limiter using sliding window counters.
    
    Advantages over in-memory:
    - Shared state across multiple API instances
    - Survives server restarts
    - More accurate limiting for distributed systems
    """

    def __init__(self, redis_url: str, config: Optional[RedisRateLimitConfig] = None):
        self.config = config or RedisRateLimitConfig()
        self._redis = None
        self._redis_url = redis_url
        self._connection_error_logged = False

    def _get_redis(self):
        """Lazy load Redis connection."""
        if self._redis is None:
            try:
                import redis
                self._redis = redis.from_url(
                    self._redis_url,
                    decode_responses=True,
                    socket_connect_timeout=1,
                    socket_timeout=1,
                )
                # Test connection
                self._redis.ping()
                self._connection_error_logged = False
            except Exception as e:
                if not self._connection_error_logged:
                    logger.warning(f"Redis connection failed, falling back to permissive mode: {e}")
                    self._connection_error_logged = True
                return None
        return self._redis

    def _is_trusted_proxy(self, ip: str) -> bool:
        """Check if an IP is a trusted proxy."""
        try:
            ip_obj = ipaddress.ip_address(ip)
            for proxy in self.config.trusted_proxies:
                try:
                    if "/" in proxy:
                        network = ipaddress.ip_network(proxy, strict=False)
                        if ip_obj in network:
                            return True
                    else:
                        if ip_obj == ipaddress.ip_address(proxy):
                            return True
                except ValueError:
                    continue
            return False
        except ValueError:
            return False

    def _get_client_key(self, request: Request) -> str:
        """Get unique key for client identification."""
        direct_ip = request.client.host if request.client else "unknown"

        if self._is_trusted_proxy(direct_ip):
            forwarded_for = request.headers.get("X-Forwarded-For")
            if forwarded_for:
                ips = [ip.strip() for ip in forwarded_for.split(",")]
                for ip in reversed(ips):
                    if not self._is_trusted_proxy(ip):
                        return ip
                return ips[0] if ips else direct_ip

        return direct_ip

    def check_rate_limit(self, request: Request) -> Tuple[bool, Optional[dict]]:
        """
        Check if request is within rate limits.

        Returns:
            Tuple of (is_allowed, rate_limit_info)
        """
        redis_client = self._get_redis()
        
        # If Redis is unavailable, allow the request (fail-open)
        if redis_client is None:
            return True, None

        try:
            now = int(time.time())
            client_key = self._get_client_key(request)
            
            # Keys for different windows
            second_key = f"rate:{client_key}:second:{now}"
            minute_key = f"rate:{client_key}:minute:{now // 60}"
            hour_key = f"rate:{client_key}:hour:{now // 3600}"

            # Use pipeline for atomic operations
            pipe = redis_client.pipeline()
            
            # Increment counters
            pipe.incr(second_key)
            pipe.expire(second_key, 2)  # 2 second TTL
            
            pipe.incr(minute_key)
            pipe.expire(minute_key, 120)  # 2 minutes TTL
            
            pipe.incr(hour_key)
            pipe.expire(hour_key, 7200)  # 2 hours TTL
            
            results = pipe.execute()
            
            second_count = results[0]
            minute_count = results[2]
            hour_count = results[4]

            # Check burst limit (per second)
            if second_count > self.config.burst_limit:
                return False, {
                    "error": "Rate limit exceeded (burst)",
                    "retry_after": 1,
                    "limit_type": "burst",
                }

            # Check minute limit
            if minute_count > self.config.requests_per_minute:
                return False, {
                    "error": "Rate limit exceeded (per minute)",
                    "retry_after": 60 - (now % 60),
                    "limit_type": "minute",
                }

            # Check hour limit
            if hour_count > self.config.requests_per_hour:
                return False, {
                    "error": "Rate limit exceeded (per hour)",
                    "retry_after": 3600 - (now % 3600),
                    "limit_type": "hour",
                }

            return True, None

        except Exception as e:
            logger.warning(f"Rate limit check failed: {e}")
            # Fail-open on errors
            return True, None

    def get_rate_limit_headers(self, request: Request) -> dict:
        """Get rate limit headers for response."""
        redis_client = self._get_redis()
        
        if redis_client is None:
            return {
                "X-RateLimit-Limit": str(self.config.requests_per_minute),
                "X-RateLimit-Remaining": "unknown",
            }

        try:
            now = int(time.time())
            client_key = self._get_client_key(request)
            minute_key = f"rate:{client_key}:minute:{now // 60}"
            
            minute_count = int(redis_client.get(minute_key) or 0)
            
            return {
                "X-RateLimit-Limit": str(self.config.requests_per_minute),
                "X-RateLimit-Remaining": str(
                    max(0, self.config.requests_per_minute - minute_count)
                ),
                "X-RateLimit-Reset": str(((now // 60) + 1) * 60),
            }
        except Exception:
            return {
                "X-RateLimit-Limit": str(self.config.requests_per_minute),
                "X-RateLimit-Remaining": "unknown",
            }


class RedisRateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware for Redis-based rate limiting."""

    def __init__(
        self,
        app,
        redis_url: str,
        config: Optional[RedisRateLimitConfig] = None,
        exclude_paths: Optional[list[str]] = None,
    ):
        super().__init__(app)
        self.limiter = RedisRateLimiter(redis_url, config)
        self.exclude_paths = exclude_paths or ["/health", "/docs", "/openapi.json", "/redoc"]

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for excluded paths
        if request.url.path in self.exclude_paths:
            return await call_next(request)

        # Skip rate limiting for non-API routes
        if not request.url.path.startswith("/api/"):
            return await call_next(request)

        # Check rate limit
        is_allowed, limit_info = self.limiter.check_rate_limit(request)

        if not is_allowed:
            logger.warning(
                f"Rate limit exceeded for {self.limiter._get_client_key(request)}",
                extra={
                    "client_ip": self.limiter._get_client_key(request),
                    "path": request.url.path,
                    "limit_type": limit_info.get("limit_type"),
                },
            )

            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "success": False,
                    "error": limit_info["error"],
                    "retry_after": limit_info["retry_after"],
                },
                headers={
                    "Retry-After": str(limit_info["retry_after"]),
                    **self.limiter.get_rate_limit_headers(request),
                },
            )

        # Process request
        response = await call_next(request)

        # Add rate limit headers to response
        for key, value in self.limiter.get_rate_limit_headers(request).items():
            response.headers[key] = value

        return response
