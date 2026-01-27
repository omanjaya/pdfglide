"""Rate limiting middleware for API protection."""

import time
import ipaddress
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Optional, Dict, Callable, Set
from functools import wraps

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.logging import get_logger

logger = get_logger(__name__)


@dataclass
class RateLimitConfig:
    """Configuration for rate limiting."""
    requests_per_minute: int = 60
    requests_per_hour: int = 1000
    burst_limit: int = 10  # Max requests in a 1-second burst
    # Trusted proxy IPs/networks - only trust X-Forwarded-For from these
    # Common values: Docker networks, load balancers, CDNs
    trusted_proxies: Set[str] = field(default_factory=lambda: {
        "127.0.0.1",
        "::1",
        "10.0.0.0/8",      # Docker default network
        "172.16.0.0/12",   # Docker networks
        "192.168.0.0/16",  # Local networks
    })


@dataclass
class RateLimitState:
    """State for tracking rate limits."""
    minute_requests: list = field(default_factory=list)
    hour_requests: list = field(default_factory=list)
    last_request_time: float = 0.0


class RateLimiter:
    """
    In-memory rate limiter using sliding window algorithm.

    For production, consider using Redis-based rate limiting.
    """

    def __init__(self, config: Optional[RateLimitConfig] = None):
        self.config = config or RateLimitConfig()
        self._states: Dict[str, RateLimitState] = defaultdict(RateLimitState)
        self._cleanup_interval = 300  # Cleanup every 5 minutes
        self._last_cleanup = time.time()

    def _is_trusted_proxy(self, ip: str) -> bool:
        """Check if an IP is a trusted proxy."""
        try:
            ip_obj = ipaddress.ip_address(ip)
            for proxy in self.config.trusted_proxies:
                try:
                    # Check if it's a network (CIDR notation)
                    if "/" in proxy:
                        network = ipaddress.ip_network(proxy, strict=False)
                        if ip_obj in network:
                            return True
                    else:
                        # Direct IP comparison
                        if ip_obj == ipaddress.ip_address(proxy):
                            return True
                except ValueError:
                    continue
            return False
        except ValueError:
            return False

    def _get_client_key(self, request: Request) -> str:
        """
        Get unique key for client identification.

        Security: Only trust X-Forwarded-For header if the request
        comes from a trusted proxy to prevent IP spoofing attacks.
        """
        direct_ip = request.client.host if request.client else "unknown"

        # Only trust X-Forwarded-For from trusted proxies
        if self._is_trusted_proxy(direct_ip):
            forwarded_for = request.headers.get("X-Forwarded-For")
            if forwarded_for:
                # Get the rightmost untrusted IP (the actual client)
                # X-Forwarded-For format: client, proxy1, proxy2, ...
                ips = [ip.strip() for ip in forwarded_for.split(",")]

                # Walk from right to left, find first non-trusted IP
                for ip in reversed(ips):
                    if not self._is_trusted_proxy(ip):
                        return ip

                # All IPs are trusted proxies, use the leftmost
                return ips[0] if ips else direct_ip

        return direct_ip

    def _cleanup_old_entries(self) -> None:
        """Remove old entries to prevent memory growth."""
        current_time = time.time()

        if current_time - self._last_cleanup < self._cleanup_interval:
            return

        hour_ago = current_time - 3600
        keys_to_remove = []

        for key, state in self._states.items():
            # Remove entries with no recent activity
            if state.last_request_time < hour_ago:
                keys_to_remove.append(key)

        for key in keys_to_remove:
            del self._states[key]

        self._last_cleanup = current_time

    def check_rate_limit(self, request: Request) -> tuple[bool, Optional[dict]]:
        """
        Check if request is within rate limits.

        Returns:
            Tuple of (is_allowed, rate_limit_info)
        """
        current_time = time.time()
        client_key = self._get_client_key(request)
        state = self._states[client_key]

        # Cleanup old entries periodically
        self._cleanup_old_entries()

        # Remove expired timestamps
        minute_ago = current_time - 60
        hour_ago = current_time - 3600

        state.minute_requests = [t for t in state.minute_requests if t > minute_ago]
        state.hour_requests = [t for t in state.hour_requests if t > hour_ago]

        # Check burst limit (requests in last second)
        second_ago = current_time - 1
        recent_requests = len([t for t in state.minute_requests if t > second_ago])
        if recent_requests >= self.config.burst_limit:
            return False, {
                "error": "Rate limit exceeded (burst)",
                "retry_after": 1,
                "limit_type": "burst",
            }

        # Check minute limit
        if len(state.minute_requests) >= self.config.requests_per_minute:
            oldest = min(state.minute_requests)
            retry_after = int(oldest + 60 - current_time) + 1
            return False, {
                "error": "Rate limit exceeded (per minute)",
                "retry_after": retry_after,
                "limit_type": "minute",
            }

        # Check hour limit
        if len(state.hour_requests) >= self.config.requests_per_hour:
            oldest = min(state.hour_requests)
            retry_after = int(oldest + 3600 - current_time) + 1
            return False, {
                "error": "Rate limit exceeded (per hour)",
                "retry_after": retry_after,
                "limit_type": "hour",
            }

        # Record this request
        state.minute_requests.append(current_time)
        state.hour_requests.append(current_time)
        state.last_request_time = current_time

        return True, None

    def get_rate_limit_headers(self, request: Request) -> dict:
        """Get rate limit headers for response."""
        client_key = self._get_client_key(request)
        state = self._states[client_key]

        current_time = time.time()
        minute_ago = current_time - 60

        minute_requests = len([t for t in state.minute_requests if t > minute_ago])

        return {
            "X-RateLimit-Limit": str(self.config.requests_per_minute),
            "X-RateLimit-Remaining": str(
                max(0, self.config.requests_per_minute - minute_requests)
            ),
            "X-RateLimit-Reset": str(int(current_time + 60)),
        }


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware for rate limiting requests."""

    def __init__(
        self,
        app,
        config: Optional[RateLimitConfig] = None,
        exclude_paths: Optional[list[str]] = None,
    ):
        super().__init__(app)
        self.limiter = RateLimiter(config)
        self.exclude_paths = exclude_paths or ["/health", "/docs", "/openapi.json"]

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


# Endpoint-specific rate limiting decorator
def rate_limit(
    requests_per_minute: int = 30,
    requests_per_hour: int = 500,
):
    """
    Decorator for endpoint-specific rate limiting.

    Usage:
        @router.post("/expensive-operation")
        @rate_limit(requests_per_minute=10)
        async def expensive_operation():
            ...
    """
    limiter = RateLimiter(
        RateLimitConfig(
            requests_per_minute=requests_per_minute,
            requests_per_hour=requests_per_hour,
        )
    )

    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, request: Request = None, **kwargs):
            # Find request in args if not in kwargs
            if request is None:
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                        break

            if request is None:
                # Can't rate limit without request
                return await func(*args, **kwargs)

            is_allowed, limit_info = limiter.check_rate_limit(request)

            if not is_allowed:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=limit_info["error"],
                    headers={"Retry-After": str(limit_info["retry_after"])},
                )

            return await func(*args, **kwargs)

        return wrapper

    return decorator
