"""
Animation class for cycling through sprite frames.
"""

from graphics._errors import migration_property_raises


class Animation:
    """Cycles through a list of sprite frames at a given fps.

    Usage::

        walk = assets.animations.hero_walk   # built from the IDE animation editor
        # or manually:
        walk = Animation([assets.sprites.walk1, assets.sprites.walk2], fps=8)

        def main():
            walk.update()
            image(walk.frame, player.x, player.y)
    """

    def __init__(self, frames, fps=8):
        self._frames = list(frames)
        self._fps = max(1, float(fps))
        self._frame_idx = 0
        self._tick_accumulator = 0.0
        self.loop = True
        self._playing = True

    # ── playback control ──────────────────────────────────────────────────────

    def play(self):
        """Resume playback."""
        self._playing = True

    def pause(self):
        """Pause playback (keeps current frame)."""
        self._playing = False

    def reset(self):
        """Jump back to the first frame and resume."""
        self._frame_idx = 0
        self._tick_accumulator = 0.0
        self._playing = True

    # ── per-frame advance ─────────────────────────────────────────────────────

    def update(self):
        """Advance the animation by one game tick. Call once per frame in main()."""
        if not self._playing or len(self._frames) <= 1:
            return
        import graphics as _g
        ticks_per_frame = max(1.0, _g._state._target_fps / self._fps)
        self._tick_accumulator += 1.0
        while self._tick_accumulator >= ticks_per_frame:
            self._tick_accumulator -= ticks_per_frame
            self._frame_idx += 1
            if self._frame_idx >= len(self._frames):
                if self.loop:
                    self._frame_idx = 0
                else:
                    self._frame_idx = len(self._frames) - 1
                    self._playing = False
                    break

    # ── current frame ─────────────────────────────────────────────────────────

    @property
    def frame(self):
        """The current frame as an image result dict (pass to image())."""
        if not self._frames:
            return None
        return self._frames[self._frame_idx]

    def is_done(self):
        """True if a non-looping animation has reached its last frame."""
        return (not self.loop) and (not self._playing) and (self._frame_idx >= len(self._frames) - 1)

    def is_playing(self):
        """True if the animation is currently advancing (not paused, not done)."""
        return self._playing

    # MIGRATION SHIM — remove after sunset. `done` was a property; it's
    # `is_done()` now (boolean-query convention, matches `Actor.is_alive()`).
    done = migration_property_raises("done", "is_done()")

    @property
    def fps(self):
        return self._fps

    @fps.setter
    def fps(self, value):
        self._fps = max(1, float(value))
