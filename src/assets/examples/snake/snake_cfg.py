"""Snake actor configuration for Snake game."""

import graphics as g
from graphics.actors.config import method
import random

TILE_SIZE = 20
GRID_SIZE = 20

x = 10
y = 10
tail = []
direction = "up"
next_direction = "up"
score = 0
grow_pending = 0


@method
def draw(self):
    cx, cy = self.get_coords()
    g.fill(0, 255, 0)
    g.rect(cx * TILE_SIZE, cy * TILE_SIZE, TILE_SIZE, TILE_SIZE)

    g.fill(0, 200, 0)
    for tx, ty in self.tail:
        g.rect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE)


@method
def update(self):
    cx, cy = self.get_coords()
    tail = self.tail
    score = self.score

    if (cx, cy) in tail:
        g.stop()
        print(f"Game Over! Score: {score}")
        return

    tail.append((cx, cy))
    if len(tail) > score:
        tail.pop(0)

    if self.direction == "right":
        cx = (cx + 1) % GRID_SIZE
    elif self.direction == "left":
        cx = (cx - 1) % GRID_SIZE
    elif self.direction == "down":
        cy = (cy + 1) % GRID_SIZE
    elif self.direction == "up":
        cy = (cy - 1) % GRID_SIZE

    self.next_direction = self.direction
    self.set_coords(cx, cy)

    if self.grow_pending > 0:
        self.score += 1
        self.grow_pending -= 1
