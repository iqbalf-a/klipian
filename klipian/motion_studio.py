"""Remotion Studio, the framework's own editor UI, started when /remotion is opened and left running for the next visit (the Motion page itself is /create).
`studio_target(composition)` returns the address to send the browser to; the Studio has its own server, so klipian only starts it and points at the video."""
from __future__ import annotations

import socket
import subprocess
import time
from pathlib import Path

from . import motion as _motion

STUDIO_PORT = 3017            # not Remotion's default 3000, which a dev server of something else often holds
_PROC: subprocess.Popen | None = None


def _open(port: int = STUDIO_PORT) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.4):
            return True
    except OSError:
        return False


def studio_target(composition: str = "", wait: float = 45.0) -> str:
    """Start the Studio when it is not running and wait for its port; returns its URL (to the video's composition when one is named).
    Raises MotionError("missing" / "node") when Node or the video project is not installed or the Studio does not come up."""
    global _PROC
    if not _open():
        ok, why = _motion._node.ready()
        if not ok:
            raise _motion.MotionError("missing", why)
        cli = _motion.REMOTION / "node_modules" / "@remotion" / "cli" / "remotion-cli.js"
        if not cli.is_file():
            raise _motion.MotionError("missing", f'Remotion Studio is not installed: run "npm install" in {_motion.REMOTION}.')
        if _PROC is None or _PROC.poll() is not None:
            _PROC = subprocess.Popen([_motion._node.exe(), str(cli), "studio", "src/index.ts", "--port", str(STUDIO_PORT), "--no-open"],
                                     cwd=str(_motion.REMOTION), stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        end = time.monotonic() + wait
        while not _open():
            if _PROC.poll() is not None or time.monotonic() > end:
                raise _motion.MotionError("node", "Remotion Studio did not start. Try `npm run studio` in the remotion folder to see why.")
            time.sleep(0.3)
    return f"http://localhost:{STUDIO_PORT}/" + (composition if composition and composition.replace("-", "").replace("_", "").isalnum() else "")


def stop_studio() -> None:
    """Called when the server stops, so the Studio does not stay behind."""
    if _PROC is not None and _PROC.poll() is None:
        _PROC.terminate()
