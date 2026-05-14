from graphics import *

COLORS = [
    ("red",    Colors.red),
    ("green",  Colors.green),
    ("blue",   Colors.blue),
    ("yellow", Colors.yellow),
    ("orange", Colors.orange),
    ("purple", Colors.purple),
    ("pink",   Colors.pink),
    ("cyan",   Colors.cyan),
    ("white",  Colors.white),
    ("black",  Colors.black),
    ("gray",   Colors.gray),
    ("brown",  Colors.brown),
]

COLS = 4
PAD  = 10
SW   = 110   # swatch width
SH   = 75    # swatch height
ROWS = (len(COLORS) + COLS - 1) // COLS
W    = COLS * SW + (COLS + 1) * PAD
H    = ROWS * SH + (ROWS + 1) * PAD + 36  # +36 for title bar


def tick():
    background(40, 40, 45)

    # Title
    no_stroke()
    fill(180, 180, 185)
    text_size(13)
    text_align("center", "top")
    text("Colors.* are theme-aware — re-run after switching theme", W // 2, 10)

    for i, (name, color) in enumerate(COLORS):
        col = i % COLS
        row = i // COLS
        x = PAD + col * (SW + PAD)
        y = 36 + PAD + row * (SH + PAD)

        # Swatch
        fill(color)
        stroke(60, 60, 65)
        stroke_width(1)
        rect(x, y, SW, SH)

        # Label: dark text on light swatches, light text on dark ones
        r, g, b = color
        brightness = (r * 299 + g * 587 + b * 114) // 1000
        if brightness < 140:
            fill(235, 235, 235)
        else:
            fill(30, 30, 30)
        no_stroke()
        text_size(13)
        text_align("center", "middle")
        text(f"Colors.{name}", x + SW // 2, y + SH // 2)


size(W, H)
run(tick, fps=1)   # static display — 1 fps keeps CPU at rest
