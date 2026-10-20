"""Send a file or folder to the Recycle Bin (never delete it for good).

On Windows this is the shell's own operation, so the person can restore it from the
Recycle Bin. Elsewhere there is no standard bin: the item moves into workspace/.trash/.
"""

from __future__ import annotations

import os
import shutil
import time
from pathlib import Path


def to_recycle_bin(path) -> None:
    path = Path(path)
    if not path.exists():
        return
    if os.name == "nt":
        _windows(path)
    else:
        from . import paths
        trash = paths.workspace_dir() / ".trash"
        trash.mkdir(parents=True, exist_ok=True)
        shutil.move(str(path), str(trash / f"{int(time.time())}-{path.name}"))


def _windows(path: Path) -> None:
    import ctypes
    from ctypes import wintypes

    class SHFILEOPSTRUCTW(ctypes.Structure):
        _fields_ = [("hwnd", wintypes.HWND), ("wFunc", wintypes.UINT),
                    ("pFrom", wintypes.LPCWSTR), ("pTo", wintypes.LPCWSTR),
                    ("fFlags", ctypes.c_ushort), ("fAnyOperationsAborted", wintypes.BOOL),
                    ("hNameMappings", ctypes.c_void_p), ("lpszProgressTitle", wintypes.LPCWSTR)]

    FO_DELETE = 3
    FOF_SILENT, FOF_NOCONFIRMATION, FOF_ALLOWUNDO, FOF_NOERRORUI = 0x4, 0x10, 0x40, 0x400
    op = SHFILEOPSTRUCTW()
    op.hwnd = None
    op.wFunc = FO_DELETE
    op.pFrom = str(path.resolve()) + "\0"          # the list ends with a double NUL
    op.pTo = None
    op.fFlags = FOF_ALLOWUNDO | FOF_NOCONFIRMATION | FOF_SILENT | FOF_NOERRORUI
    result = ctypes.windll.shell32.SHFileOperationW(ctypes.byref(op))
    if result != 0 or op.fAnyOperationsAborted:
        raise OSError(f"could not move {path.name} to the Recycle Bin (code {result})")
