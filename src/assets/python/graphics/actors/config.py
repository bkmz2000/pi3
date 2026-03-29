"""
Actor configuration helpers for from_cfg().

Usage:
    # snake_cfg.py
    from actors.config import method

    x = 10
    y = 10
    tail = []

    @method
    def draw(self):
        ...

    @method
    def update(self):
        ...

    # main.py
    from actors import Actor
    import snake_cfg

    snake = Actor.from_cfg(snake_cfg)
"""

from types import MethodType


def method(func):
    """
    Decorator to mark a function as an actor method for from_cfg().

    Functions decorated with @method will be bound to the actor instance
    and can access actor state via self.xxx.
    """
    func._is_actor_method = True
    return func


def from_cfg(module):
    """
    Create an Actor from a configuration module.

    The module should define:
    - x, y (optional) - initial coordinates passed to set_coords()
    - Any number of data attributes (tail, direction, score, etc.)
    - Functions decorated with @method to become actor methods

    Example:
        # snake_cfg.py
        from actors.config import method
        x = 10; y = 10
        tail = []

        @method
        def draw(self): ...

        @method
        def update(self): ...

    Usage:
        import snake_cfg
        snake = Actor.from_cfg(snake_cfg)
    """
    from graphics.actors import Actor

    methods = {}
    initial_state = {}
    coords = None

    for name in dir(module):
        if name.startswith("_"):
            continue
        obj = getattr(module, name)
        if callable(obj) and getattr(obj, "_is_actor_method", False):
            methods[name] = obj
        elif callable(obj):
            pass
        else:
            if name in ("x", "y"):
                if name == "x":
                    coords = (obj, coords[1] if coords else None)
                else:
                    coords = (coords[0] if coords else None, obj)
            else:
                if isinstance(obj, list):
                    initial_state[name] = list(obj)
                elif isinstance(obj, dict):
                    initial_state[name] = dict(obj)
                else:
                    initial_state[name] = obj

    actor = Actor(**initial_state)

    for name, func in methods.items():
        bound_method = MethodType(func, actor)
        setattr(actor, name, bound_method)

    if coords and coords[0] is not None and coords[1] is not None:
        actor.set_coords(coords[0], coords[1])

    return actor
