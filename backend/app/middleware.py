"""Rate limiting and security middleware."""
import time
import logging
from collections import defaultdict
from fastapi import Request, HTTPException, status

logger = logging.getLogger(__name__)


class RateLimiter:
    """Simple in-memory rate limiter (per-IP token bucket).

    For production, replace with Redis-based implementation.
    """

    def __init__(self, requests_per_minute: int = 60, burst: int = 10):
        self._rate = requests_per_minute
        self._burst = burst
        self._buckets: dict[str, tuple[float, int]] = defaultdict(
            lambda: (time.monotonic(), burst)
        )
        self._cleanup_at = time.monotonic() + 300  # Cleanup every 5 min

    async def __call__(self, request: Request):
        # Periodic cleanup of stale entries
        now = time.monotonic()
        if now > self._cleanup_at:
            threshold = now - 300
            stale = [k for k, (t, _) in self._buckets.items() if t < threshold]
            for k in stale:
                del self._buckets[k]
            self._cleanup_at = now + 300

        # Identify client
        client_ip = request.client.host if request.client else "unknown"

        # Token bucket
        last_time, tokens = self._buckets[client_ip]
        elapsed = now - last_time
        refill = elapsed * (self._rate / 60.0)
        tokens = min(self._burst, tokens + refill)
        last_time = now

        if tokens < 1:
            logger.warning(f"Rate limit exceeded for {client_ip} on {request.url.path}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please slow down.",
            )

        tokens -= 1
        self._buckets[client_ip] = (last_time, tokens)
