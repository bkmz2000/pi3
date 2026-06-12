"""Sheet animation types: SheetAnimation, SpriteEntry, SheetNamespace, AnimationController."""

from graphics._errors import FriendlyError, FriendlyAttrError


class SheetAnimation:
    """An animation strip from the project sheet: an ordered list of Sprite frames.

    Indexing wraps with modulo so a frame counter can advance freely.
    When passed to `image()` or used as an Actor image, resolves to frame [0].
    """

    def __init__(self, frames):
        self._frames = list(frames)

    def __getitem__(self, idx):
        if not self._frames:
            raise FriendlyError(
                "friendlyError.logic.spriteNoFrames",
                raw="SheetAnimation has no frames",
            )
        return self._frames[int(idx) % len(self._frames)]

    def __len__(self):
        return len(self._frames)

    def _default_sprite(self):
        return self._frames[0] if self._frames else None

    def __repr__(self):
        return f"SheetAnimation({len(self._frames)} frames)"


class SpriteEntry:
    """A named sprite from the project sheet.

    Attribute access returns a SheetAnimation by animation name.
    When passed to `image()` or used as an Actor image, resolves to frame 0
    of the first animation.
    """

    def __init__(self, name, animations):
        self._name = name
        self._animations = animations  # dict[str, SheetAnimation]

    def _default_sprite(self):
        for anim in self._animations.values():
            s = anim._default_sprite()
            if s is not None:
                return s
        return None

    def __getattr__(self, name):
        if name.startswith('_'):
            raise AttributeError(name)
        anim = self._animations.get(name)
        if anim is None:
            avail = list(self._animations.keys())
            raise FriendlyAttrError(
                "friendlyError.naming.noAnimation",
                {"sprite": self._name, "name": name, "available": ", ".join(avail) or "none"},
                raw=f"Sprite '{self._name}' has no animation '{name}'. Available: {avail}",
            )
        return anim

    def __repr__(self):
        return f"SpriteEntry({self._name!r}, animations={list(self._animations.keys())})"


class SheetNamespace:
    """Namespace of named sprites from the project sheet (assets.sheet).

    Attribute access returns a SpriteEntry by name.
    """

    def __init__(self, entries):
        self._entries = entries  # dict[str, SpriteEntry]

    def __getattr__(self, name):
        if name.startswith('_'):
            raise AttributeError(name)
        entry = self._entries.get(name)
        if entry is None:
            avail = list(self._entries.keys())
            raise FriendlyAttrError(
                "friendlyError.naming.noSprite",
                {"name": name, "available": ", ".join(avail) or "none"},
                raw=f"Sheet has no sprite '{name}'. Available: {avail}",
            )
        return entry

    def __repr__(self):
        return f"SheetNamespace({list(self._entries.keys())})"


class AnimationController:
    """Per-actor animation state for one animation name.

    Obtained via ``actor.<anim_name>`` when ``actor.image`` is a SpriteEntry.
    Call ``tick()`` once per frame to advance; ``actor.draw()`` reads the result.

    On the first tick after switching animations the frame resets to 0 with
    no advance, so the first frame of the new animation is always shown for
    a full frame.
    """

    def __init__(self, actor, anim_name):
        self._actor = actor
        self._anim_name = anim_name
        self._frame_idx = 0
        self._ticked_this_frame = False

    def tick(self):
        if self._ticked_this_frame:
            import sys as _sys
            print(
                f"Warning: {self._anim_name}.tick() called twice in one frame — "
                "call it once per update()", file=_sys.stderr
            )
            return self
        prev_name = getattr(self._actor, '_last_active_anim', None)
        self._actor._last_active_anim = self._anim_name
        self._actor._active_anim_ctrl = self
        if prev_name != self._anim_name:
            # Animation switched — reset to frame 0, no advance this tick.
            self._frame_idx = 0
        else:
            image = self._actor.image
            if isinstance(image, SpriteEntry):
                anim = image._animations.get(self._anim_name)
                if anim and anim._frames:
                    self._frame_idx = (self._frame_idx + 1) % len(anim._frames)
        self._ticked_this_frame = True
        return self

    @property
    def frame_idx(self):
        return self._frame_idx

    def __repr__(self):
        return f"AnimationController({self._anim_name!r}, frame={self._frame_idx})"
