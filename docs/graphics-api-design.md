# Graphics API Design

**Status**: Draft - in progress

This document outlines the planned redesign of the Python graphics API for the Web IDE. The goal is a more explicit, OOP-friendly API that leverages kids' natural intuition about "types of things" (actors) and event-driven programming.

---

## Core Concepts

### 1. The `graphics` Module

The `graphics` module (imported as `g`) provides:

- **Window management**: `g.size(w, h)`, `g.run()`
- **Drawing primitives**: `g.circle(x, y, r)`, `g.rect(x, y, w, h)`, `g.line(x1, y1, x2, y2)`, `g.text(s, x, y)`
- **Drawing state**: `g.fill(r, g, b)`, `g.no_fill()`, `g.stroke(r, g, b)`, `g.no_stroke()`, `g.stroke_width(w)`
- **Global event handlers**: `g.on_mouse_move`, `g.on_key_press`, `g.on_collide`, `g.every`
- **Query functions**: `g.mouse_x()`, `g.mouse_y()`, `g.key_pressed(key)`, `g.width()`, `g.height()`
- **Actor system**: `Actor` base class
- **Assets**: `g.assets` (sprite loading)

### 2. Planning vs Execution

The key insight: **drawing commands are planned, then executed by `g.run()`**.

```python
import graphics as g

g.circle(100, 100, 50)    # Planned: draw a circle at (100, 100) with radius 50
g.rect(200, 200, 80, 40) # Planned: draw a rectangle
g.size(400, 400)          # Planned: create a 400x400 window
g.run()                   # Execute all plans
```

This means:
- Drawing commands can be called anywhere, anytime
- If no window exists, commands are queued
- `g.run()` creates the window and executes all planned operations

### 3. Actor System

#### Defining Actors

Actors are defined as classes extending `Actor`:

```python
class Player(Actor):
    image = g.assets.sprites.p1_front
    speed = 5
    health = 3
    
    @setup
    def init(self):
        """Called when actor is created"""
        self.set_coords(g.width() // 2, g.height() - 50)
```

**Property access:**
- System properties (`x`, `y`, `angle`) are **readable** but require setter methods to modify
- User-defined properties (like `speed`, `health`) are fully accessible

```python
player = Player()
print(player.x)       # OK - read x position
print(player.speed)  # OK - read user property
player.x = 100       # ERROR - must use setter
player.set_coords(100, 200)  # OK - use setter method
```

**Public methods:**
- `set_coords(x, y)` - set position
- `get_coords()` - returns `(x, y)` tuple
- `rotate_clockwise(degrees)` - rotate (angle increases clockwise)
- `get_angle()` - get rotation in degrees
- `move_forward(distance)` - move in current facing direction
- `move_left(distance)`, `move_right(distance)`, `move_up(distance)`, `move_down(distance)` - absolute direction movement
- `set_speed(vx, vy)` - set velocity vector
- `hide()` - make invisible and non-collidable
- `ghost()` - make visible but non-collidable
- `die()` - remove actor from scene

#### Creating Actor Instances

```python
player = Player()  # Creates a player, calls @setup init()
enemy = Enemy()    # Creates an enemy
```

#### Event Handlers on Actors

Events are defined on **actor classes**, referencing **actor subtypes**:

```python
class Enemy(Actor):
    image = g.assets.sprites.enemy
    health = 100
    
    @setup
    def init(self):
        import random
        self.set_coords(random.randint(50, g.width() - 50), 0)
        self.rotate_clockwise(180)  # Face downward
    
    @g.on_collide(Player)
    def handle_hit(self, player):
        """Called when this enemy collides with a Player.
        'player' is the specific Player instance that was hit."""
        self.health -= 10
        if self.health <= 0:
            self.die()
    
    @g.on_collide_any(Player, Bullet)  # Collision with any of these types
    def handle_hit(self, other):
        """Called when this enemy collides with Player OR Bullet."""
        self.health -= 5
        if self.health <= 0:
            self.die()
    
    @g.every(60)  # Every 60 frames (1 second at 60fps)
    def fall(self):
        x, y = self.get_coords()
        self.set_coords(x, y + 30)
```

**Key insight:** `@g.on_collide(Player)` references the `Player` **class** (subtype), but the handler receives a specific **instance** (`player`).

#### Global Event Handlers

```python
@g.every(1)  # Every frame (60fps by default) - global game loop
def game_loop():
    pass

@g.on_key_press("escape")
def pause_game():
    global paused
    paused = not paused

@g.on_mouse_move
def handle_mouse(x, y):
    """Global mouse move handler"""
    pass
```

**Handler execution order:** Global handlers run first, then actor-specific handlers.

### 4. Timing

```python
@g.every(60)     # Every 60 frames (1 second at 60fps)
def spawn_enemy():
    enemy = Enemy()
```

### 5. Assets

```python
from graphics import assets

player_sprite = assets.sprites.p1_front
enemy_sprite = assets.sprites.star
```

Assets are organized as:
- `assets.sprites.*` - image files

### 6. Z-Order

Actors have a draw order (z-index):
- By default, actors are drawn in the order they were created
- Actors defined first appear "below" actors defined later
- Use `actor.bring_to_front()` or `actor.send_to_back()` to change z-order

```python
background = Background()  # Drawn first (bottom)
player = Player()          # Drawn on top of background
player.bring_to_front()    # Now player is drawn on top
```

### 7. Messaging (Advanced)

Actors can broadcast and receive custom messages:

```python
# In Player class:
def some_action(self):
    self.broadcast("player_moved", data={"x": self.get_coords()[0], "y": self.get_coords()[1]})

# In Enemy class:
@g.enemy.on("player_moved", author=Player)
def seek_player(self, author_instance, data):
    """Handle 'player_moved' message from any Player instance.
    'author_instance' is the specific Player that sent the message."""
    px, py = author_instance.get_coords()
    self.move_towards(px, py)
```

---

## Space Invaders Sketch

Here's how a Space Invaders-style game might look:

```python
import graphics as g
from graphics import assets
from graphics.actors import Actor

score = 0

class Player(Actor):
    image = assets.sprites.p1_front
    
    @setup
    def init(self):
        self.set_coords(g.width() // 2, g.height() - 60)
    
    @g.on_key_press("a", "arrow_left")
    def move_left(self):
        self.move_left(5)
    
    @g.on_key_press("d", "arrow_right")
    def move_right(self):
        self.move_right(5)
    
    @g.on_key_press(" ")
    def shoot(self):
        bullet = Bullet()
        bx, by = self.get_coords()
        bullet.set_coords(bx, by)
        bullet.active = True

class Enemy(Actor):
    image = assets.sprites.star
    
    @setup
    def init(self):
        import random
        x = random.randint(50, g.width() - 50)
        self.set_coords(x, 0)
        self.rotate_clockwise(180)
    
    @g.every(60)
    def fall(self):
        x, y = self.get_coords()
        self.set_coords(x, y + 30)
        
        if y > g.height() - 30:
            g.stop()
    
    @g.on_collide(Bullet)
    def hit_by_bullet(self, bullet):
        global score
        score += 100
        self.die()
        bullet.die()

class Bullet(Actor):
    image = assets.sprites.bullet
    
    @setup
    def init(self):
        self.active = False  # User-defined visibility/tracking flag
    
    @g.every(1)
    def move_up(self):
        if not self.active:
            return
        x, y = self.get_coords()
        self.set_coords(x, y - 10)
        
        if y < 0:
            self.active = False
            self.die()

@g.every(120)
def spawn_wave():
    enemy = Enemy()

@g.setup
def init_game():
    g.size(800, 600)
    player = Player()

g.run()
```

---

## Design Decisions

### Why class-based OOP?

Kids naturally think in terms of "a type of thing" (enemy, player, bullet). Classes match this mental model:
- `Player` is a *type* of thing
- `player1` and `player2` are *instances* of that type

This is more intuitive than:
- Global lists of objects
- Factory functions
- Prototype-based cloning

### Why read-only x, y, angle with setters?

Beginner programmers often get confused by:
- `x` meaning "horizontal position" vs `x` meaning "width" in rectangles
- Angle units (degrees vs radians)
- Coordinate systems (is Y up or down?)

By providing high-level methods (`set_coords`, `rotate_clockwise`, `move_forward`), we:
- Avoid coordinate confusion
- Make rotation intuitive (clockwise degrees)
- Provide a clean API that can evolve internally

### Why events reference actor types, not instances?

```python
@g.on_collide(Player)
def handle_hit(self, player):
    # 'Player' is a type (class)
    # 'player' is the specific instance that was hit
```

This allows:
- A single handler to respond to collisions with any `Player` instance
- The handler receives the specific instance that triggered the collision
- Easy to ask "which player was hit?" vs "what type of actor?"

### Timing Model

- `g.every(N)` - every N frames (at 60fps by default)
- `g.on_key_press(key)` - when key is pressed
- `g.on_mouse_move` - when mouse moves globally
- `@actor.every(N)` - timer on actor class
- `@actor.on_collide(OtherActor)` - collision event

### Planning Model

All drawing and window operations are "planned" until `g.run()` is called:

```python
g.circle(100, 100, 50)  # Not drawn yet
g.size(400, 400)        # Window not created yet
g.run()                  # NOW everything executes
```

This allows:
- Drawing commands to be anywhere in code
- Conditional drawing
- Dynamic scenes based on game state

### Z-Order

Default draw order is creation order (first defined = bottom):
```python
background = Background()  # Bottom
player = Player()          # Middle
enemies = [Enemy() for _ in range(5)]  # Top (most recent)
```

Change explicitly:
```python
player.bring_to_front()
background.send_to_back()
```

---

## Open Questions

1. **How do actor instances communicate?**
   - Global variables (simple, familiar) - recommended for now
   - Message passing via `broadcast` (powerful, advanced) - deferred

2. **Multiple windows?**
   - Single window for now
   - Interface should be flexible enough for future expansion

3. **Sound support?**
   - Deferred for now
