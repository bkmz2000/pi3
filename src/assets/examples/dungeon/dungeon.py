# Torch-lit dungeon — explore the room with arrow keys.
#
# Showcases the new graphics features:
#   - Light(): multiply-blended overlay with shadow-casting obstacles
#   - Light.style(Themes.current): ambient + shade pulled from the active theme
#     (set the project theme via the sprite editor dropdown to retint the scene)
#   - Light.shade("candle") + Light.flicker(True): warm flickering torches
#   - Actor.future_state.collides_any(walls): wall-stop without a sweep test;
#     try each axis separately so the player slides along walls
#   - Polar(speed, angle): build velocity from a speed + angle. angle is
#     visual-only — motion comes from .vel
#
# Try switching the project theme to "dungeon" or "moonlit" in the sprite
# editor — the ambient + torch color follow automatically.

from graphics import *

theme = Themes.current
FLOOR_RGB = (60, 50, 40)

# Player (we'll tint it so it's visible against the dim floor)
player = Rect(80, 80, 16, 16, color=theme.cyan)

# Walls forming a small room with two interior dividers
walls = Group()
for x, y, w, h in (
    (0,   0,   480,  16),  # top wall
    (0,   324, 480,  16),  # bottom wall
    (0,   0,   16,   340), # left wall
    (464, 0,   16,   340), # right wall
    (140, 60,  16,   180), # vertical divider A
    (280, 100, 16,   200), # vertical divider B
    (300, 60,  100,  16),  # short horizontal stub
):
    walls.add(Rect(x + w/2, y + h/2, w, h, color=theme.gray))

# Three stationary torch positions
torches = [(220, 60), (420, 60), (60, 290)]

# Build the light overlay once; it reads positions live each frame.
light = (
    Light(radius=150)
    .style(theme)        # ambient + base shade from the active theme
    .shade("candle")     # override shade with a warm candle color
    .flicker(True)       # deterministic [0.85, 1.0] intensity wobble
)
light.add_obstacles(walls)
for tx, ty in torches:
    light.add_source((tx, ty))
light.add_source(player)  # the player carries a softer light too


def try_move(vx, vy):
    """Set player.vel and return True if next frame would collide a wall."""
    player.vel = (vx, vy)
    return player.future_state.collides_any(walls) is not None


def main():
    background(*FLOOR_RGB)

    # Read input
    speed = 2.5
    vx = (1 if Keyboard.arrow_right.down else 0) - (1 if Keyboard.arrow_left.down else 0)
    vy = (1 if Keyboard.arrow_down.down  else 0) - (1 if Keyboard.arrow_up.down   else 0)
    vx *= speed
    vy *= speed

    # Wall-stop using future_state. If the diagonal move would collide, try
    # each axis independently so we slide along walls instead of getting stuck.
    if try_move(vx, vy):
        if try_move(vx, 0):
            if try_move(0, vy):
                player.vel = (0, 0)

    # Draw walls and player
    for w in walls:
        w.draw()
    player.draw()

    # Draw torches as small bright dots (the lightmap will glow around them)
    no_stroke()
    fill(255, 210, 130)
    for tx, ty in torches:
        circle(tx, ty, 3)

    # HUD
    fill(200, 200, 210)
    text_size(11)
    text_align("left", "top")
    text(f"theme: {theme.name}   (change in sprite editor)", 24, 24)

    # Composite the lighting overlay LAST so it multiplies over everything.
    light.draw()


size(480, 340)
run(main, fps=60)
