# Internal mutable state for the graphics module.
# Import this module by object — never do `from ._state import name` and then
# rebind it; that creates a local copy and silently breaks the shared state.
# Correct pattern (in any submodule):
#   from . import _state
#   _state._running = True        # writes the shared attribute

_width = 300
_height = 300
_running = False
_stop_requested = False

_draw_commands = []
_pending_size = None

_fill_color = (255, 255, 255)
_stroke_color = (0, 0, 0)
_stroke_width = 1
_current_fill = True
_current_stroke = True

_mouse_x = 0
_mouse_y = 0
_mouse_down = False
_mouse_clicked = False
_mouse_released = False

_keys_down = set()
_keys_pressed = set()
_keys_released = set()

_target_fps = 60
_pending_timer_id = None
_loop_generation = 0
_show_hitboxes = False

# Set by worker.ts before each run so _tick can classify runtime errors.
_user_code = ""
_user_filename = "main.py"

tick_proxy = None
