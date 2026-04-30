"""
Lightweight progress-reporting helpers used by excel_import_*.py modules.

Two modes:
  - CLI (default): prints to stdout.
  - HTTP streaming: set a thread-local callback via set_progress_callback() so the
    Flask SSE endpoint can forward each message to the browser in real time.
"""

from __future__ import annotations

import sys
import threading

_local = threading.local()


# ── Callback control ──────────────────────────────────────────────────────────

def set_progress_callback(fn) -> None:
    """Register a callable(msg: str) for the current thread."""
    _local.callback = fn


def clear_progress_callback() -> None:
    """Remove the callback for the current thread."""
    _local.callback = None


def _emit(msg: str) -> None:
    cb = getattr(_local, "callback", None)
    if cb is not None:
        try:
            cb(msg)
        except Exception:
            pass
    else:
        print(msg, flush=True)


# ── Public helpers ────────────────────────────────────────────────────────────

def progress_step(total: int, target_lines: int = 40) -> int:
    """Return how often (every N rows) to emit a progress line."""
    if total <= 0:
        return 1
    return max(1, total // target_lines)


def progress_message(msg: str) -> None:
    """Emit a plain status message."""
    _emit(msg)


def progress_line(current: int, total: int, prefix: str = "") -> None:
    """Emit a compact progress line: 'prefix 42/100 (42%)'."""
    pct = int(round(current / total * 100)) if total > 0 else 0
    msg = f"{prefix}{current}/{total}  ({pct}%)"
    cb = getattr(_local, "callback", None)
    if cb is not None:
        _emit(msg)
    else:
        sys.stdout.write(f"\r  {msg}   ")
        sys.stdout.flush()
        if current >= total:
            sys.stdout.write("\n")
            sys.stdout.flush()


def progress_done() -> None:
    """Finalise a progress line (no-op in callback mode)."""
    cb = getattr(_local, "callback", None)
    if cb is None:
        sys.stdout.write("\n")
        sys.stdout.flush()
