"""The `read_json` decorator for the POST handlers of server.Handler."""

from __future__ import annotations

import functools


def read_json(fn):
    """A handler that takes the request's JSON object as `req`: the body is read first, and one that cannot be read (too large, not
    JSON, not an object) is answered with a 400 and the reason before the handler runs."""
    @functools.wraps(fn)
    def wrapper(self):
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        return fn(self, req)
    return wrapper
