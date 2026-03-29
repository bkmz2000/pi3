import math

# SimpleNamespace will be available in the runtime
# We'll import it only when needed in the copy() method

# Constants for collider types
CIRCLE = "circle"
RECT = "rect"
AUTO = "auto"
CENTER = "center"
TOPLEFT = "topleft"
CORNER = "corner"  # p5.js constant - we define our own to avoid import issues


def Actor(image=None, x=0, y=0, angle=0, anchor=CENTER, **kwargs):
    """
    Create a game actor.

    Args:
        image: Sprite image (from assets.sprites)
        x, y: Position
        angle: Rotation in radians (0 = facing right)
        anchor: "center" or "topleft" - where the image is anchored
        **kwargs: Additional properties like collider, radius, width, height

    Returns:
        An actor object with methods for movement and drawing.
    """
    return _Actor(image, x, y, angle, anchor, **kwargs)


class _Actor:
    """Internal Actor class - kids use Actor() function instead"""

    def __init__(self, image=None, x=0, y=0, angle=0, anchor=CENTER, **kwargs):
        self.image = image
        self.x = float(x)
        self.y = float(y)
        self.angle = float(angle)  # in radians, 0 = facing right
        self.anchor = anchor

        # Collision properties
        self.collider = kwargs.get("collider", CIRCLE)

        if self.collider == CIRCLE:
            radius = kwargs.get("radius", AUTO)
            if radius == AUTO and image:
                # Try to auto-calculate from image
                try:
                    # Images might have width/height attributes
                    if hasattr(image, "width") and hasattr(image, "height"):
                        self.radius = min(image.width, image.height) / 2
                    else:
                        self.radius = 20  # Default fallback
                except Exception:
                    self.radius = 20
            else:
                self.radius = float(radius) if radius != AUTO else 20

        elif self.collider == RECT:
            self.width = float(kwargs.get("width", 50))
            self.height = float(kwargs.get("height", 50))

        # Physics properties
        self.vx = 0.0  # velocity x
        self.vy = 0.0  # velocity y
        self.speed = 0.0  # forward speed (for move() method)

        # Store any custom properties
        for key, value in kwargs.items():
            if key not in ["collider", "radius", "width", "height"]:
                setattr(self, key, value)

    def rotate_to(self, target_x, target_y):
        """
        Rotate to face a point.

        Args:
            target_x, target_y: Point to face towards

        Returns:
            self (for method chaining)
        """
        dx = target_x - self.x
        dy = target_y - self.y
        self.angle = math.atan2(dy, dx)
        return self

    def point_towards(self, target):
        """
        Point towards another actor or an angle.

        Args:
            target: Either an actor object or an angle in radians

        Returns:
            self (for method chaining)
        """
        if hasattr(target, "x") and hasattr(target, "y"):
            # It's an actor
            self.rotate_to(target.x, target.y)
        else:
            # It's an angle
            self.angle = float(target)
        return self

    def move(self, distance):
        """
        Move forward in current direction.

        Args:
            distance: How far to move

        Returns:
            self (for method chaining)
        """
        self.x += math.cos(self.angle) * distance
        self.y += math.sin(self.angle) * distance
        return self

    def move_with_speed(self):
        """
        Move based on velocity (vx, vy).

        Returns:
            self (for method chaining)
        """
        self.x += self.vx
        self.y += self.vy
        return self

    def draw(self):
        """
        Draw the actor at its current position and rotation.

        Returns:
            self (for method chaining)
        """
        if self.image:
            try:
                # Try to use p5.js functions if available
                # These might not be available during import or in non-p5 contexts
                push()

                # Apply transformations
                translate(self.x, self.y)
                rotate(self.angle)

                # Set image mode based on anchor
                if self.anchor == CENTER:
                    imageMode(CENTER)
                    image(self.image, 0, 0)
                elif self.anchor == TOPLEFT:
                    # Use our own CORNER constant
                    imageMode(CORNER)
                    image(self.image, 0, 0)

                # Restore drawing state
                pop()
            except NameError:
                # p5.js functions not available - this is OK during import
                # The draw() method will work when called from within a p5 sketch
                pass
        return self

    def copy(self):
        """
        Create a copy of this actor.

        Returns:
            A new actor with the same properties
        """
        # Create basic actor
        if self.collider == CIRCLE:
            new_actor = Actor(
                image=self.image,
                x=float(self.x),
                y=float(self.y),
                angle=float(self.angle),
                anchor=self.anchor,
                collider=self.collider,
                radius=float(self.radius),
            )
        else:  # RECT
            new_actor = Actor(
                image=self.image,
                x=float(self.x),
                y=float(self.y),
                angle=float(self.angle),
                anchor=self.anchor,
                collider=self.collider,
                width=float(self.width),
                height=float(self.height),
            )

        # Copy physics properties
        new_actor.vx = self.vx
        new_actor.vy = self.vy
        new_actor.speed = self.speed

        # Copy any custom properties
        for attr_name in dir(self):
            if not attr_name.startswith("_") and attr_name not in [
                "image",
                "x",
                "y",
                "angle",
                "anchor",
                "collider",
                "radius",
                "width",
                "height",
                "vx",
                "vy",
                "speed",
            ]:
                try:
                    value = getattr(self, attr_name)
                    setattr(new_actor, attr_name, value)
                except Exception:
                    pass

        return new_actor

    def distance_to(self, other):
        """
        Calculate distance to another actor or point.

        Args:
            other: Either an actor or a tuple (x, y)

        Returns:
            Distance as float
        """
        if hasattr(other, "x") and hasattr(other, "y"):
            # It's an actor
            dx = self.x - other.x
            dy = self.y - other.y
        else:
            # Assume it's a point (x, y)
            dx = self.x - other[0]
            dy = self.y - other[1]

        return math.sqrt(dx * dx + dy * dy)

    def __repr__(self):
        """String representation for debugging"""
        if self.collider == CIRCLE:
            return f"Actor(x={self.x:.1f}, y={self.y:.1f}, angle={self.angle:.2f}, radius={self.radius:.1f})"
        else:
            return f"Actor(x={self.x:.1f}, y={self.y:.1f}, angle={self.angle:.2f}, width={self.width:.1f}, height={self.height:.1f})"


# Collision functions
def collides(a, b):
    """
    Check if two actors collide.

    Args:
        a, b: Actor objects

    Returns:
        True if they collide, False otherwise
    """
    if a.collider == CIRCLE and b.collider == CIRCLE:
        # Circle-circle collision
        dx = a.x - b.x
        dy = a.y - b.y
        distance_sq = dx * dx + dy * dy
        radius_sum = a.radius + b.radius
        return distance_sq < radius_sum * radius_sum

    elif a.collider == RECT and b.collider == RECT:
        # Rectangle-rectangle collision (AABB)
        return (
            a.x < b.x + b.width
            and a.x + a.width > b.x
            and a.y < b.y + b.height
            and a.y + a.height > b.y
        )

    elif a.collider == CIRCLE and b.collider == RECT:
        # Circle-rectangle collision
        return _circle_rect_collision(a, b)

    elif a.collider == RECT and b.collider == CIRCLE:
        # Rectangle-circle collision (swap arguments)
        return _circle_rect_collision(b, a)

    return False


def point_in(actor, x, y):
    """
    Check if a point is inside an actor.

    Args:
        actor: Actor object
        x, y: Point coordinates

    Returns:
        True if point is inside, False otherwise
    """
    if actor.collider == CIRCLE:
        dx = x - actor.x
        dy = y - actor.y
        return dx * dx + dy * dy < actor.radius * actor.radius

    elif actor.collider == RECT:
        return (
            actor.x <= x <= actor.x + actor.width
            and actor.y <= y <= actor.y + actor.height
        )

    return False


def _circle_rect_collision(circle, rect):
    """Helper function for circle-rectangle collision"""
    # Find the closest point on the rectangle to the circle
    closest_x = max(rect.x, min(circle.x, rect.x + rect.width))
    closest_y = max(rect.y, min(circle.y, rect.y + rect.height))

    # Calculate distance between circle center and closest point
    dx = circle.x - closest_x
    dy = circle.y - closest_y

    # Check if distance is less than circle radius
    return dx * dx + dy * dy < circle.radius * circle.radius


# Helper functions for common game patterns
def bounce_off_edges(actor, width, height):
    """
    Bounce actor off canvas edges.

    Args:
        actor: Actor object
        width, height: Canvas dimensions

    Returns:
        actor (for chaining)
    """
    if actor.collider == CIRCLE:
        if actor.x - actor.radius < 0:
            actor.x = actor.radius
            actor.vx = abs(actor.vx)  # Bounce right
        elif actor.x + actor.radius > width:
            actor.x = width - actor.radius
            actor.vx = -abs(actor.vx)  # Bounce left

        if actor.y - actor.radius < 0:
            actor.y = actor.radius
            actor.vy = abs(actor.vy)  # Bounce down
        elif actor.y + actor.radius > height:
            actor.y = height - actor.radius
            actor.vy = -abs(actor.vy)  # Bounce up

    elif actor.collider == RECT:
        if actor.x < 0:
            actor.x = 0
            actor.vx = abs(actor.vx)
        elif actor.x + actor.width > width:
            actor.x = width - actor.width
            actor.vx = -abs(actor.vx)

        if actor.y < 0:
            actor.y = 0
            actor.vy = abs(actor.vy)
        elif actor.y + actor.height > height:
            actor.y = height - actor.height
            actor.vy = -abs(actor.vy)

    return actor


def wrap_around_edges(actor, width, height):
    """
    Wrap actor around canvas edges (pac-man style).

    Args:
        actor: Actor object
        width, height: Canvas dimensions

    Returns:
        actor (for chaining)
    """
    if actor.collider == CIRCLE:
        if actor.x < -actor.radius:
            actor.x = width + actor.radius
        elif actor.x > width + actor.radius:
            actor.x = -actor.radius

        if actor.y < -actor.radius:
            actor.y = height + actor.radius
        elif actor.y > height + actor.radius:
            actor.y = -actor.radius

    elif actor.collider == RECT:
        if actor.x + actor.width < 0:
            actor.x = width
        elif actor.x > width:
            actor.x = -actor.width

        if actor.y + actor.height < 0:
            actor.y = height
        elif actor.y > height:
            actor.y = -actor.height

    return actor


def move_towards(actor, target_x, target_y, speed):
    """
    Move actor towards a point.

    Args:
        actor: Actor object
        target_x, target_y: Target point
        speed: Movement speed

    Returns:
        actor (for chaining)
    """
    dx = target_x - actor.x
    dy = target_y - actor.y
    distance = math.sqrt(dx * dx + dy * dy)

    if distance > 0:
        actor.x += (dx / distance) * speed
        actor.y += (dy / distance) * speed

    return actor


def keep_on_screen(actor, width, height):
    """
    Keep actor on screen (clamp to edges).

    Args:
        actor: Actor object
        width, height: Canvas dimensions

    Returns:
        actor (for chaining)
    """
    if actor.collider == CIRCLE:
        actor.x = max(actor.radius, min(actor.x, width - actor.radius))
        actor.y = max(actor.radius, min(actor.y, height - actor.radius))

    elif actor.collider == RECT:
        actor.x = max(0, min(actor.x, width - actor.width))
        actor.y = max(0, min(actor.y, height - actor.height))

    return actor


# Example usage (commented out for documentation):
"""
# Create an actor
player = Actor(
    image=assets.sprites.spaceship,
    x=100, y=100,
    collider=CIRCLE,
    radius=AUTO,  # Auto-calculate from image
    health=100  # Custom property
)

# Create a bullet template
BulletTemplate = Actor(
    image=assets.sprites.bullet,
    collider=CIRCLE,
    radius=3,
    damage=10
)

# In draw function:
player.rotate_to(mouseX, mouseY)
player.move(2)
player.draw()

# Check collisions
if collides(player, enemy):
    player.health -= 10

# Create bullet from template
bullet = BulletTemplate.copy()
bullet.x = player.x
bullet.y = player.y
bullet.angle = player.angle
"""
