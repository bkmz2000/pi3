# Theme palette reference — every built-in Themes.<name>.<color> at a glance.
#
# Showcases:
#   - Themes.<name>.<color> for "default", "summer", "dungeon", "moonlit"
#   - Themes.current: the project's active theme (set in the sprite editor)
#   - Theme palette parity: every theme defines the same color names as Colors
#
# This is a static reference card — it runs at 1 fps to keep the CPU quiet.

from graphics import Themes, fill, no_stroke, stroke, stroke_width, rect, text, text_size, text_align, background, size, run

THEME_NAMES = ["default", "summer", "dungeon", "moonlit"]
COLOR_NAMES = [
    "red", "green", "blue", "yellow", "orange", "purple",
    "pink", "cyan", "white", "black", "gray", "brown",
]

CELL = 30
GAP = 6
TITLE_H = 28
LABEL_W = 80
FOOTER_H = 30

W = LABEL_W + len(THEME_NAMES) * (CELL + GAP) + GAP
H = TITLE_H + len(COLOR_NAMES) * (CELL + GAP) + GAP + FOOTER_H


def main():
    background(28, 28, 34)

    # Column headers: theme names
    no_stroke()
    fill(225, 225, 230)
    text_size(13)
    text_align("center", "middle")
    for col, tname in enumerate(THEME_NAMES):
        cx = LABEL_W + col * (CELL + GAP) + CELL // 2
        text(tname, cx, TITLE_H // 2 + 4)

    # Highlight the column for Themes.current
    current_name = Themes.current.name
    if current_name in THEME_NAMES:
        hi_col = THEME_NAMES.index(current_name)
        hx = LABEL_W + hi_col * (CELL + GAP) - 2
        hy = TITLE_H - 2
        hw = CELL + 4
        hh = len(COLOR_NAMES) * (CELL + GAP) + 4
        no_stroke()
        fill(60, 90, 140)
        rect(hx, hy, hw, hh)

    # Rows: one per color name × per theme swatch
    for row, cname in enumerate(COLOR_NAMES):
        ry = TITLE_H + row * (CELL + GAP)

        # Row label
        text_align("right", "middle")
        no_stroke()
        fill(205, 205, 215)
        text(cname, LABEL_W - 8, ry + CELL // 2)

        for col, tname in enumerate(THEME_NAMES):
            cx = LABEL_W + col * (CELL + GAP)
            color = getattr(getattr(Themes, tname), cname)
            fill(color)
            stroke(50, 50, 60)
            stroke_width(1)
            rect(cx, ry, CELL, CELL)

    # Footer: Themes.current label
    no_stroke()
    fill(180, 200, 255)
    text_size(12)
    text_align("left", "middle")
    text(
        f"Themes.current = {current_name!r}   change in the sprite editor toolbar",
        12,
        H - FOOTER_H // 2,
    )


size(W, H)
run(main, fps=1)
