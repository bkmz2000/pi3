"""Apple actor configuration for Snake game."""

import random

import graphics as g
from graphics.actors.config import method

TILE_SIZE = 20
GRID_SIZE = 20

x = 15
y = 15


@method
def draw(self):
    cx, cy = self.get_coords()
    g.fill(255, 0, 0)
    g.circle(
        cx * TILE_SIZE + TILE_SIZE // 2,
        cy * TILE_SIZE + TILE_SIZE // 2,
        TILE_SIZE // 2,
    )


@method
def relocate(self):
    while True:
        nx = random.randint(0, GRID_SIZE - 1)
        ny = random.randint(0, GRID_SIZE - 1)
        if (nx, ny) not in self.avoid:
            break
    self.set_coords(nx, ny)
