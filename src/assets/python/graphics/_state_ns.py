"""
State: a simple mutable namespace for game-level variables.
"""


class State:
    """Game-level variable container.

    Pass named keyword arguments to set initial values::

        state = State(score=0, lives=3, level=1)
        state.score += 10

    Attributes can be freely added and changed at any time.
    """

    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            object.__setattr__(self, key, value)

    def __repr__(self):
        items = ", ".join(f"{k}={v!r}" for k, v in self.__dict__.items())
        return f"State({items})"
