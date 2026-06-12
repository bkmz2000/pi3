"""Utility helpers: clamp, randint, pick, Sound, Timer."""

import time as _time

from graphics._errors import FriendlyError


def clamp(value, lo, hi):
    """Clamp `value` between `lo` and `hi` (inclusive).

        x = clamp(x, 0, 300)   # keep x inside the canvas
        vol = clamp(vol, 0, 1)  # keep volume in [0, 1]
    """
    return max(lo, min(hi, value))


def randint(a, b) -> int:
    """Random integer between a and b inclusive.

        x = randint(0, 300)
    """
    import random as _random
    return _random.randint(int(a), int(b))


def pick(seq):
    """Pick a random item from a sequence.

        color = pick([Colors.red, Colors.blue, Colors.green])
        tile  = pick(["grass", "sand", "stone"])
    """
    import random as _random
    items = list(seq)
    if not items:
        raise FriendlyError(
            "friendlyError.logic.emptySequence",
            raw="pick() called on empty sequence",
        )
    return _random.choice(items)


class Sound:
    """Audio clip controlled from Python. Audio playback lives on the main
    thread; this class just sends messages.

    Usage:
        assets.sounds.pop.play()
        assets.sounds.music.loop()
        assets.sounds.music.set_volume(0.5)
        assets.sounds.music.pause()
        assets.sounds.music.stop()
    """

    def __init__(self, name):
        self.name = name

    def _post(self, action, value=None):
        try:
            import js
            js._ide_post_sound(action, self.name, value)
        except Exception:
            pass

    def play(self):
        """Play the sound once. Multiple calls overlap."""
        self._post("play")

    def loop(self):
        """Play the sound repeatedly until stopped."""
        self._post("loop")

    def pause(self):
        """Pause all currently playing instances of this sound."""
        self._post("pause")

    def stop(self):
        """Stop all currently playing instances and reset to the start."""
        self._post("stop")

    def set_volume(self, value):
        """Set volume for future plays (0.0 = silent, 1.0 = full).
        Does not affect already-playing instances."""
        self._post("volume", float(value))


class Timer:
    """Poll-based countdown timer in seconds.

    Usage:
        t = Timer(s=2)
        # in update():
        if t.done():
            spawn_enemy()
            t.restart()
    """

    def __init__(self, s=None, ms=None):
        if s is None and ms is None:
            self._duration = 0.0
        elif s is not None:
            self._duration = float(s)
        else:
            self._duration = float(ms) / 1000.0
        self._start = _time.monotonic()

    def left(self) -> float:
        return self._duration - (_time.monotonic() - self._start)

    def elapsed(self) -> float:
        return _time.monotonic() - self._start

    def done(self) -> bool:
        return self.left() <= 0

    def restart(self, s=None, ms=None) -> None:
        if s is not None:
            self._duration = float(s)
        elif ms is not None:
            self._duration = float(ms) / 1000.0
        self._start = _time.monotonic()
