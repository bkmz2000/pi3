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
_show_actor_info = False

_paused = False       # True = tick loop suspended; resume() restarts it
_step_once = False    # True = run exactly one tick then re-pause
_speed_divisor = 1    # tick interval multiplier: 1=1x, 2=½x, 4=¼x

_watches: dict = {}       # label -> repr-string; cleared each tick
_watch_last_sent = 0.0    # JS timestamp of last flush; for throttle

# Set by worker.ts before each run so _tick can classify runtime errors.
_user_code = ""
_user_filename = "main.py"

tick_proxy = None

# pi3.debug module state (do not access via from-import — use _state._debug_*)
_debug_slots: dict = {}         # {(filename, lineno): slot_dict}
_debug_frames: list = []        # list of captured frames (each sent to JS individually)
_debug_fresh_slots: set = set() # slots registered since last show()
# Set by worker.ts's plain-script runner before each run: how many harness-only
# lines precede student code in that run's compiled unit (0 for the graphics
# path, which compiles student code as its own unit with no such wrapper).
# _register() subtracts this so reported/looked-up line numbers match the
# file actually written to Pyodide's FS (which linecache reads from).
_debug_line_offset: int = 0
