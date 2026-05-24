export type DocParam = {
  name: string;
  type: string;
  optional?: boolean;
  default?: string;
  en: string;
  ru: string;
};

export type DocEntry = {
  id: string;
  name: string;
  signature: string;
  en: string;
  ru: string;
  params?: DocParam[];
  returns?: { type: string; en: string; ru: string };
  // A short runnable snippet shown under the description.
  example?: string;
  // Long-form notes shown in a collapsed "Advanced" section.
  advanced?: { en: string; ru: string };
};

export type DocCategory = {
  id: string;
  en: string;
  ru: string;
  entries: DocEntry[];
};

export const DOCS: DocCategory[] = [
  // ─── Canvas ────────────────────────────────────────────────────────────────
  {
    id: "canvas",
    en: "Canvas",
    ru: "Холст",
    entries: [
      {
        id: "size",
        name: "size",
        signature: "size(w, h)",
        en: "Set the size of the canvas window.",
        ru: "Устанавливает размер окна холста.",
        params: [
          { name: "w", type: "number", en: "Width in pixels.", ru: "Ширина в пикселях." },
          { name: "h", type: "number", en: "Height in pixels.", ru: "Высота в пикселях." },
        ],
      },
      {
        id: "width",
        name: "width",
        signature: "width()",
        en: "Returns the current canvas width in pixels.",
        ru: "Возвращает текущую ширину холста в пикселях.",
        returns: { type: "number", en: "Canvas width.", ru: "Ширина холста." },
      },
      {
        id: "height",
        name: "height",
        signature: "height()",
        en: "Returns the current canvas height in pixels.",
        ru: "Возвращает текущую высоту холста в пикселях.",
        returns: { type: "number", en: "Canvas height.", ru: "Высота холста." },
      },
    ],
  },

  // ─── Drawing ───────────────────────────────────────────────────────────────
  {
    id: "draw",
    en: "Drawing",
    ru: "Рисование",
    entries: [
      {
        id: "background",
        name: "background",
        signature: 'background(color)  /  background(r, g, b)',
        en: 'Clear the canvas. Accepts a color name, an RGB tuple from Colors, or three numbers 0–255. Example: background("black") or background(Colors.blue).',
        ru: 'Очищает холст. Принимает название цвета, кортеж RGB из Colors или три числа 0–255. Пример: background("black") или background(Colors.blue).',
        params: [
          { name: "color", type: "str | tuple | number", en: 'Color name, Colors.* tuple, a gray value, or r, g, b components.', ru: 'Название цвета, кортеж Colors.*, оттенок серого или компоненты r, g, b.' },
        ],
      },
      {
        id: "circle",
        name: "circle",
        signature: "circle(x, y, radius)",
        en: "Draw a filled circle centered at (x, y) with the given radius.",
        ru: "Рисует закрашенный круг с центром в точке (x, y) и заданным радиусом.",
        params: [
          { name: "x", type: "number", en: "Center X position.", ru: "Координата X центра." },
          { name: "y", type: "number", en: "Center Y position.", ru: "Координата Y центра." },
          { name: "radius", type: "number", en: "Radius of the circle.", ru: "Радиус круга." },
        ],
      },
      {
        id: "rect",
        name: "rect",
        signature: "rect(x, y, w, h)",
        en: "Draw a filled rectangle. The top-left corner is at (x, y).",
        ru: "Рисует закрашенный прямоугольник. Левый верхний угол находится в точке (x, y).",
        params: [
          { name: "x", type: "number", en: "Left edge X.", ru: "Координата X левого края." },
          { name: "y", type: "number", en: "Top edge Y.", ru: "Координата Y верхнего края." },
          { name: "w", type: "number", en: "Width.", ru: "Ширина." },
          { name: "h", type: "number", en: "Height.", ru: "Высота." },
        ],
      },
      {
        id: "ellipse",
        name: "ellipse",
        signature: "ellipse(x, y, w, h)",
        en: "Draw a filled ellipse centered at (x, y). Omit h to draw a circle.",
        ru: "Рисует закрашенный эллипс с центром в точке (x, y). Опустите h, чтобы нарисовать круг.",
        params: [
          { name: "x", type: "number", en: "Center X.", ru: "Координата X центра." },
          { name: "y", type: "number", en: "Center Y.", ru: "Координата Y центра." },
          { name: "w", type: "number", en: "Width (horizontal diameter).", ru: "Ширина (горизонтальный диаметр)." },
          { name: "h", type: "number", optional: true, en: "Height (vertical diameter). Defaults to w.", ru: "Высота (вертикальный диаметр). По умолчанию равна w." },
        ],
      },
      {
        id: "line",
        name: "line",
        signature: "line(x1, y1, x2, y2)",
        en: "Draw a line between two points.",
        ru: "Рисует линию между двумя точками.",
        params: [
          { name: "x1", type: "number", en: "Start X.", ru: "Начальная координата X." },
          { name: "y1", type: "number", en: "Start Y.", ru: "Начальная координата Y." },
          { name: "x2", type: "number", en: "End X.", ru: "Конечная координата X." },
          { name: "y2", type: "number", en: "End Y.", ru: "Конечная координата Y." },
        ],
      },
      {
        id: "point",
        name: "point",
        signature: "point(x, y)",
        en: "Draw a single dot at position (x, y).",
        ru: "Рисует одну точку в позиции (x, y).",
        params: [
          { name: "x", type: "number", en: "X position.", ru: "Координата X." },
          { name: "y", type: "number", en: "Y position.", ru: "Координата Y." },
        ],
      },
      {
        id: "text",
        name: "text",
        signature: "text(s, x, y)  /  text(s, anchor)",
        en: "Draw a string. Pass an x, y position for manual placement, or an AnchorPoint (e.g. Window.top_right, actor.top) for automatic edge alignment with padding.",
        ru: "Рисует строку текста. Передайте x, y для ручного размещения или AnchorPoint (например, Window.top_right, actor.top) для автоматического выравнивания у края с отступом.",
        params: [
          { name: "s", type: "str", en: "The text to display.", ru: "Текст для отображения." },
          { name: "x", type: "number", en: "X position (when not using an anchor).", ru: "Координата X (без якоря)." },
          { name: "y", type: "number", en: "Y position (when not using an anchor).", ru: "Координата Y (без якоря)." },
          { name: "anchor", type: "AnchorPoint", en: "A Window or actor anchor. Sets alignment and padding automatically.", ru: "Якорь Window или актора. Автоматически устанавливает выравнивание и отступ." },
        ],
      },
      {
        id: "say",
        name: "say",
        signature: "say(s, anchor)",
        en: "Draw a speech bubble with a tail pointing at anchor. Use an actor anchor like actor.top to place the bubble above the actor. Works with any AnchorPoint.",
        ru: "Рисует облачко с хвостиком, указывающим на якорь. Используйте якорь актора, например actor.top, чтобы разместить облачко над актором. Работает с любым AnchorPoint.",
        params: [
          { name: "s", type: "str", en: "The text inside the bubble.", ru: "Текст внутри облачка." },
          { name: "anchor", type: "AnchorPoint", en: "Where the tail points. Use actor.top, actor.right, Window.center, etc.", ru: "Куда указывает хвостик. Используйте actor.top, actor.right, Window.center и т.д." },
          { name: "padding", type: "number", optional: true, default: "8", en: "Space between the text and bubble edge.", ru: "Отступ между текстом и краем облачка." },
        ],
      },
      {
        id: "text_size",
        name: "text_size",
        signature: "text_size(n)",
        en: "Set the font size for text() calls.",
        ru: "Устанавливает размер шрифта для вызовов text().",
        params: [
          { name: "n", type: "number", en: "Font size in pixels.", ru: "Размер шрифта в пикселях." },
        ],
      },
      {
        id: "text_align",
        name: "text_align",
        signature: 'text_align(horizontal, vertical)',
        en: 'Set text alignment. Use "left", "center", or "right" for horizontal; "top", "middle", or "bottom" for vertical.',
        ru: 'Устанавливает выравнивание текста. Горизонтальное: "left", "center", "right"; вертикальное: "top", "middle", "bottom".',
        params: [
          { name: "horizontal", type: "str", en: '"left", "center", or "right".', ru: '"left", "center" или "right".' },
          { name: "vertical", type: "str", optional: true, default: '"top"', en: '"top", "middle", or "bottom".', ru: '"top", "middle" или "bottom".' },
        ],
      },
      {
        id: "image",
        name: "image",
        signature: "image(img, x, y, w, h)",
        en: "Draw a sprite image at position (x, y). Use assets.sprites to get images.",
        ru: "Рисует спрайт в позиции (x, y). Используйте assets.sprites для получения изображений.",
        params: [
          { name: "img", type: "sprite", en: "The sprite from assets.sprites.", ru: "Спрайт из assets.sprites." },
          { name: "x", type: "number", en: "X position (top-left corner).", ru: "Координата X (левый верхний угол)." },
          { name: "y", type: "number", en: "Y position (top-left corner).", ru: "Координата Y (левый верхний угол)." },
          { name: "w", type: "number", optional: true, en: "Draw width. Defaults to sprite's natural width.", ru: "Ширина отрисовки. По умолчанию — естественная ширина спрайта." },
          { name: "h", type: "number", optional: true, en: "Draw height. Defaults to sprite's natural height.", ru: "Высота отрисовки. По умолчанию — естественная высота спрайта." },
        ],
      },
    ],
  },

  // ─── Color ─────────────────────────────────────────────────────────────────
  {
    id: "color",
    en: "Color",
    ru: "Цвет",
    entries: [
      {
        id: "colors_palette",
        name: "Colors",
        signature: "Colors.<name>",
        en: "A palette of named colors that match the current editor theme. Use them anywhere a color is accepted. Available names: red, green, blue, yellow, orange, purple, pink, cyan, white, black, gray, brown. Colors update when you switch theme and re-run. For per-project theme palettes (e.g. for a dungeon scene), see Themes — Themes.<name>.<color> exposes the same names with mood-specific RGB.",
        ru: "Палитра именованных цветов, соответствующих текущей теме редактора. Используйте их везде, где принимается цвет. Доступные имена: red, green, blue, yellow, orange, purple, pink, cyan, white, black, gray, brown. Цвета обновляются при смене темы и перезапуске. Для палитр конкретного проекта (например, в подземелье) смотрите Themes — Themes.<name>.<color> предоставляет те же имена в нужной атмосфере.",
        params: [
          { name: "Colors.red", type: "tuple", en: "A warm red.", ru: "Тёплый красный." },
          { name: "Colors.green", type: "tuple", en: "A bright green.", ru: "Яркий зелёный." },
          { name: "Colors.blue", type: "tuple", en: "A vivid blue.", ru: "Насыщенный синий." },
          { name: "Colors.yellow", type: "tuple", en: "A golden yellow.", ru: "Золотисто-жёлтый." },
          { name: "Colors.orange", type: "tuple", en: "An orange.", ru: "Оранжевый." },
          { name: "Colors.purple", type: "tuple", en: "A purple.", ru: "Фиолетовый." },
          { name: "Colors.pink", type: "tuple", en: "A soft pink.", ru: "Нежно-розовый." },
          { name: "Colors.cyan", type: "tuple", en: "A cyan / aqua.", ru: "Голубой / аквамарин." },
          { name: "Colors.white", type: "tuple", en: "White.", ru: "Белый." },
          { name: "Colors.black", type: "tuple", en: "Black.", ru: "Чёрный." },
          { name: "Colors.gray", type: "tuple", en: "A medium gray.", ru: "Средне-серый." },
          { name: "Colors.brown", type: "tuple", en: "A brown.", ru: "Коричневый." },
        ],
      },
      {
        id: "fill_color",
        name: "fill",
        signature: 'fill(color)  /  fill(r, g, b)  /  fill(None)',
        en: 'Set the fill color. Accepts a color name string ("red"), a Colors.* tuple, three RGB numbers (0–255), a single gray value, or None to disable fill (same as no_fill()).',
        ru: 'Устанавливает цвет заливки. Принимает строку с названием цвета ("red"), кортеж Colors.*, три числа RGB (0–255), одно число для серого или None для отключения заливки (то же, что no_fill()).',
        params: [
          { name: "color", type: "str | tuple | number | None", en: 'Color name, Colors.* value, RGB tuple, gray value, or None.', ru: 'Название цвета, значение Colors.*, кортеж RGB, оттенок серого или None.' },
        ],
      },
      {
        id: "no_fill",
        name: "no_fill",
        signature: "no_fill()  /  fill(None)",
        en: "Disable fill so shapes are drawn as outlines only. fill(None) is a shorthand for the same effect.",
        ru: "Отключает заливку — фигуры рисуются только контуром. fill(None) — сокращённая запись с тем же эффектом.",
      },
      {
        id: "stroke_color",
        name: "stroke",
        signature: 'stroke(color)  /  stroke(r, g, b)  /  stroke(None)',
        en: 'Set the outline color. Accepts a color name, a Colors.* tuple, three RGB values, or None to disable the outline (same as no_stroke()).',
        ru: 'Устанавливает цвет обводки. Принимает название цвета, кортеж Colors.*, три значения RGB или None для отключения обводки (то же, что no_stroke()).',
        params: [
          { name: "color", type: "str | tuple | number | None", en: 'Color name, Colors.* value, RGB components, or None.', ru: 'Название цвета, значение Colors.*, компоненты RGB или None.' },
        ],
      },
      {
        id: "no_stroke",
        name: "no_stroke",
        signature: "no_stroke()  /  stroke(None)",
        en: "Disable outline so shapes are drawn without borders. stroke(None) is a shorthand for the same effect.",
        ru: "Отключает обводку — фигуры рисуются без границ. stroke(None) — сокращённая запись с тем же эффектом.",
      },
      {
        id: "stroke_width",
        name: "stroke_width",
        signature: "stroke_width(w)",
        en: "Set the thickness of outlines and lines in pixels.",
        ru: "Устанавливает толщину обводки и линий в пикселях.",
        params: [
          { name: "w", type: "number", en: "Line thickness in pixels.", ru: "Толщина линии в пикселях." },
        ],
      },
    ],
  },

  // ─── Transforms ────────────────────────────────────────────────────────────
  {
    id: "transform",
    en: "Transforms",
    ru: "Трансформации",
    entries: [
      {
        id: "push",
        name: "push",
        signature: "push()",
        en: "Save the current drawing state (fill, stroke, transforms). Use with pop().",
        ru: "Сохраняет текущее состояние рисования (заливка, обводка, трансформации). Используйте вместе с pop().",
      },
      {
        id: "pop",
        name: "pop",
        signature: "pop()",
        en: "Restore the drawing state saved with push().",
        ru: "Восстанавливает состояние рисования, сохранённое с помощью push().",
      },
      {
        id: "translate",
        name: "translate",
        signature: "translate(x, y)",
        en: "Move the drawing origin by (x, y). Shapes drawn after this will be shifted.",
        ru: "Перемещает начало системы координат на (x, y). Фигуры, нарисованные после, будут смещены.",
        params: [
          { name: "x", type: "number", en: "Horizontal shift.", ru: "Горизонтальное смещение." },
          { name: "y", type: "number", en: "Vertical shift.", ru: "Вертикальное смещение." },
        ],
      },
      {
        id: "rotate",
        name: "rotate",
        signature: "rotate(angle)",
        en: "Rotate the coordinate system by the given angle in degrees (clockwise).",
        ru: "Поворачивает систему координат на заданный угол в градусах (по часовой стрелке).",
        params: [
          { name: "angle", type: "number", en: "Rotation angle in degrees.", ru: "Угол поворота в градусах." },
        ],
      },
      {
        id: "scale",
        name: "scale",
        signature: "scale(x, y)",
        en: "Scale the drawing. Pass one value for uniform scale, or two for independent axes.",
        ru: "Масштабирует рисование. Одно значение — равномерное масштабирование; два — по каждой оси отдельно.",
        params: [
          { name: "x", type: "number", en: "Horizontal scale factor.", ru: "Коэффициент масштабирования по горизонтали." },
          { name: "y", type: "number", optional: true, en: "Vertical scale factor. Defaults to x.", ru: "Коэффициент масштабирования по вертикали. По умолчанию равен x." },
        ],
      },
      {
        id: "camera",
        name: "Camera",
        signature: "with Camera() as cam: ...",
        en: "A 2D camera offset. Use as a context manager — inside `with cam:` everything you draw is shifted so the camera's position appears at the center of the canvas. Combine with cam.follow(actor) for scrolling worlds.",
        ru: "Двухмерное смещение камеры. Используется как контекстный менеджер — внутри `with cam:` всё, что рисуется, сдвигается так, чтобы позиция камеры оказывалась в центре холста. В сочетании с cam.follow(actor) удобно для прокручиваемых уровней.",
        params: [
          { name: "Camera(x=0, y=0)", type: "—", en: "Create a camera at world position (x, y).", ru: "Создать камеру в мировой позиции (x, y)." },
          { name: "cam.pos", type: "Vector2", en: "Camera position as a Vector2 (mutable).", ru: "Позиция камеры как Vector2 (изменяемая)." },
          { name: "cam.follow(actor, lerp=1.0)", type: "Camera", en: "Make the camera track an actor each frame. lerp=1.0 snaps; values <1 smooth.", ru: "Камера следует за актором каждый кадр. lerp=1.0 — мгновенно; меньшие значения сглаживают движение." },
          { name: "cam.unfollow()", type: "Camera", en: "Stop following.", ru: "Перестать следовать за актором." },
          { name: "with cam: ...", type: "—", en: "Inside the block, draw calls are shifted so the camera position lands at the canvas center.", ru: "Внутри блока все вызовы рисования сдвигаются так, чтобы позиция камеры оказалась в центре холста." },
        ],
      },
    ],
  },

  // ─── Math ──────────────────────────────────────────────────────────────────
  {
    id: "math",
    en: "Math",
    ru: "Математика",
    entries: [
      {
        id: "vector2",
        name: "Vector2 / Point",
        signature: "Vector2(x, y)  /  Point(x, y)",
        en: "A 2D vector with arithmetic and geometry helpers. `Point` is an alias of `Vector2` — use whichever reads more naturally. Accepts numeric pairs, tuples, or other Vector2s in arithmetic. Mutable: you can assign to `.x` and `.y`.",
        ru: "Двухмерный вектор с арифметикой и геометрическими методами. `Point` — псевдоним `Vector2`, используйте тот, что читается естественнее. Поддерживает арифметику с парами чисел, кортежами и другими Vector2. Изменяемый: можно присваивать `.x` и `.y`.",
        params: [
          { name: "v.x, v.y", type: "number", en: "Components (mutable).", ru: "Компоненты (изменяемые)." },
          { name: "v + w / v - w / -v", type: "Vector2", en: "Arithmetic with another Vector2 or a 2-tuple.", ru: "Арифметика с другим Vector2 или парой (x, y)." },
          { name: "v * k / v / k", type: "Vector2", en: "Scalar multiply / divide.", ru: "Умножение / деление на скаляр." },
          { name: "v == w", type: "bool", en: "Component-wise equality.", ru: "Покомпонентное сравнение." },
          { name: "v.length / v.length_sq", type: "number", en: "Magnitude and squared magnitude.", ru: "Длина и квадрат длины." },
          { name: "v.distance_to(w)", type: "number", en: "Distance to another vector or 2-tuple.", ru: "Расстояние до другого вектора или пары." },
          { name: "v.dot(w)", type: "number", en: "Dot product.", ru: "Скалярное произведение." },
          { name: "v.normalized()", type: "Vector2", en: "Unit vector in the same direction (zero vector stays zero).", ru: "Единичный вектор в том же направлении (нулевой вектор остаётся нулевым)." },
        ],
      },
      {
        id: "polar",
        name: "Polar",
        signature: "Polar(magnitude, angle_degrees)",
        en: "Build a Vector2 from a magnitude and an angle in degrees. Angle convention matches actor.angle and actor.move(): 0° = east (+x), 90° = south (+y, screen y-down), 180° = west, 270° = north. The most common use is setting actor.vel for continuous motion at an angle without writing the trig yourself.",
        ru: "Создаёт Vector2 из модуля и угла в градусах. Соглашение об угле совпадает с actor.angle и actor.move(): 0° = восток (+x), 90° = юг (+y, ось вниз), 180° = запад, 270° = север. Чаще всего применяется для задания actor.vel — непрерывное движение под углом без ручной тригонометрии.",
        params: [
          { name: "magnitude", type: "number", en: "Length of the resulting vector (e.g. speed in pixels per frame).", ru: "Длина итогового вектора (например, скорость в пикселях за кадр)." },
          { name: "angle_degrees", type: "number", en: "Direction in degrees. Pass actor.angle to match a sprite's facing.", ru: "Направление в градусах. Передайте actor.angle, чтобы совпасть с направлением спрайта." },
          { name: "Polar(120, 60)", type: "Vector2", en: "120 px/frame at 60° (down-right). Assign to actor.vel for movement.", ru: "120 px/кадр под 60° (вниз-вправо). Присвойте actor.vel для движения." },
          { name: "Polar(8, ship.angle)", type: "Vector2", en: "Bullet velocity that matches the ship's current facing.", ru: "Скорость пули, совпадающая с текущим направлением корабля." },
        ],
        returns: { type: "Vector2", en: "A new Vector2 of the given magnitude in the given direction.", ru: "Новый Vector2 заданной длины в заданном направлении." },
      },
    ],
  },

  // ─── Animation ─────────────────────────────────────────────────────────────
  {
    id: "animation",
    en: "Animation",
    ru: "Анимация",
    entries: [
      {
        id: "run",
        name: "run",
        signature: "run(main, fps=60)",
        en: "Start the game loop. The function main() is called every frame to draw and update your program. Also available as Window.run(main, fps).",
        ru: "Запускает игровой цикл. Функция main() вызывается каждый кадр для рисования и обновления программы. Также доступно как Window.run(main, fps).",
        params: [
          { name: "main", type: "function", en: "A function called each frame. No arguments.", ru: "Функция, вызываемая каждый кадр. Без аргументов." },
          { name: "fps", type: "number", optional: true, default: "60", en: "Target frames per second.", ru: "Целевая частота кадров в секунду." },
        ],
      },
      {
        id: "stop",
        name: "stop",
        signature: "stop()",
        en: "Stop the game loop. Also available as Window.stop().",
        ru: "Останавливает игровой цикл. Также доступно как Window.stop().",
      },
      {
        id: "frame_rate",
        name: "frame_rate",
        signature: "frame_rate(fps)",
        en: "Change the target frame rate while the game loop is running.",
        ru: "Изменяет целевую частоту кадров во время работы игрового цикла.",
        params: [
          { name: "fps", type: "number", en: "New target frames per second.", ru: "Новая целевая частота кадров в секунду." },
        ],
      },
      {
        id: "frame_count",
        name: "frame_count",
        signature: "frame_count",
        en: "Read-only integer that counts how many frames have elapsed since the last run(). Starts at 0 and increments by 1 each frame. Useful for timing events: if frame_count % 60 == 0: ...",
        ru: "Целое число только для чтения — количество кадров с момента последнего run(). Начинается с 0 и увеличивается на 1 каждый кадр. Удобно для таймингов: if frame_count % 60 == 0: ...",
        returns: { type: "int", en: "Current frame index.", ru: "Текущий индекс кадра." },
      },
      {
        id: "timer",
        name: "Timer",
        signature: "Timer(s=None, ms=None)",
        en: "Wall-clock countdown timer. Poll t.done() (or t.left() <= 0) each frame, then call t.restart() to start the next interval. Frame-rate independent. Example: t = Timer(s=2); if t.done(): spawn(); t.restart()",
        ru: "Таймер обратного отсчёта по реальному времени. Каждый кадр проверяйте t.done() (или t.left() <= 0), затем вызывайте t.restart() для следующего интервала. Не зависит от частоты кадров. Пример: t = Timer(s=2); if t.done(): spawn(); t.restart()",
        params: [
          { name: "s", type: "number", optional: true, en: "Duration in seconds.", ru: "Длительность в секундах." },
          { name: "ms", type: "number", optional: true, en: "Duration in milliseconds (alternative to s).", ru: "Длительность в миллисекундах (вместо s)." },
        ],
      },
      {
        id: "timer_left",
        name: "Timer.left",
        signature: "t.left()",
        en: "Seconds remaining. Negative when the timer has expired.",
        ru: "Секунды до срабатывания. Отрицательное число — таймер истёк.",
        returns: { type: "float", en: "Seconds remaining.", ru: "Секунды до конца." },
      },
      {
        id: "timer_elapsed",
        name: "Timer.elapsed",
        signature: "t.elapsed()",
        en: "Seconds since the timer was started or last restarted.",
        ru: "Секунды с момента запуска или последнего restart().",
        returns: { type: "float", en: "Seconds since start.", ru: "Секунды с момента старта." },
      },
      {
        id: "timer_done",
        name: "Timer.done",
        signature: "t.done()",
        en: "True when the interval has elapsed.",
        ru: "True, если интервал прошёл.",
        returns: { type: "bool", en: "Whether the timer has fired.", ru: "Сработал ли таймер." },
      },
      {
        id: "timer_restart",
        name: "Timer.restart",
        signature: "t.restart(s=None, ms=None)",
        en: "Reset the timer's start point. Pass a new s or ms to also change the duration.",
        ru: "Сбрасывает счёт времени. Можно передать новые s или ms, чтобы изменить длительность.",
        params: [
          { name: "s", type: "number", optional: true, en: "New duration in seconds.", ru: "Новая длительность в секундах." },
          { name: "ms", type: "number", optional: true, en: "New duration in milliseconds.", ru: "Новая длительность в миллисекундах." },
        ],
      },
      {
        id: "sounds",
        name: "assets.sounds",
        signature: "assets.sounds.<name>",
        en: "Audio clips. Upload mp3/ogg/wav files in the Assets panel under the Sounds tab; access them as assets.sounds.<name>. Methods: play(), loop(), pause(), stop(). Each play() allocates a fresh stream, so overlapping plays work. Example: assets.sounds.pop.play()",
        ru: "Аудио-клипы. Загружайте mp3/ogg/wav в панели Ассеты на вкладке Звуки; обращайтесь как assets.sounds.<имя>. Методы: play(), loop(), pause(), stop(). Каждый play() запускает отдельный поток, поэтому звуки могут накладываться. Пример: assets.sounds.pop.play()",
      },
      {
        id: "sound_play",
        name: "Sound.play",
        signature: "assets.sounds.<name>.play()",
        en: "Play the sound once from the start.",
        ru: "Воспроизводит звук один раз с начала.",
      },
      {
        id: "sound_loop",
        name: "Sound.loop",
        signature: "assets.sounds.<name>.loop()",
        en: "Play the sound on repeat until stop() is called.",
        ru: "Воспроизводит звук в цикле, пока не будет вызван stop().",
      },
      {
        id: "sound_pause",
        name: "Sound.pause",
        signature: "assets.sounds.<name>.pause()",
        en: "Pause the most recently started instance of this sound.",
        ru: "Ставит на паузу последний запущенный экземпляр звука.",
      },
      {
        id: "sound_stop",
        name: "Sound.stop",
        signature: "assets.sounds.<name>.stop()",
        en: "Stop every instance of this sound and reset playback.",
        ru: "Останавливает все экземпляры звука и сбрасывает воспроизведение.",
      },
    ],
  },

  // ─── Window & Anchors ──────────────────────────────────────────────────────
  {
    id: "window",
    en: "Window & Anchors",
    ru: "Окно и якоря",
    entries: [
      {
        id: "window_singleton",
        name: "Window",
        signature: "Window",
        en: "A singleton with canvas size, anchor points, and game-loop control. Window.width and Window.height always reflect the current canvas size — unlike width() and height(), they update immediately when the canvas is resized.",
        ru: "Объект-синглтон с размерами холста, якорными точками и управлением игровым циклом. Window.width и Window.height всегда отражают текущий размер холста.",
        params: [
          { name: "Window.width", type: "number", en: "Current canvas width in pixels.", ru: "Текущая ширина холста в пикселях." },
          { name: "Window.height", type: "number", en: "Current canvas height in pixels.", ru: "Текущая высота холста в пикселях." },
          { name: "Window.size(w, h)", type: "—", en: "Same as size(w, h).", ru: "То же, что size(w, h)." },
          { name: "Window.run(main, fps)", type: "—", en: "Same as run(main, fps).", ru: "То же, что run(main, fps)." },
          { name: "Window.stop()", type: "—", en: "Same as stop().", ru: "То же, что stop()." },
        ],
      },
      {
        id: "window_anchors",
        name: "Window anchors",
        signature: "Window.<edge>",
        en: "AnchorPoints at screen edges and corners. Pass one to text() or say() for automatic edge-aligned placement with built-in padding. All positions update dynamically if the canvas is resized.",
        ru: "Якорные точки у краёв и углов экрана. Передайте одну в text() или say() для автоматического размещения у края с отступом. Все позиции обновляются динамически при изменении размера холста.",
        params: [
          { name: "Window.top_left", type: "AnchorPoint", en: "Top-left corner (text aligns left, baseline top).", ru: "Левый верхний угол (текст по левому краю, базовая линия сверху)." },
          { name: "Window.top_right", type: "AnchorPoint", en: "Top-right corner (text aligns right, baseline top).", ru: "Правый верхний угол (текст по правому краю, базовая линия сверху)." },
          { name: "Window.top", type: "AnchorPoint", en: "Top center (text centered, baseline top).", ru: "Верхний центр (текст по центру, базовая линия сверху)." },
          { name: "Window.bottom_left", type: "AnchorPoint", en: "Bottom-left corner (text aligns left, baseline bottom).", ru: "Левый нижний угол (текст по левому краю, базовая линия снизу)." },
          { name: "Window.bottom_right", type: "AnchorPoint", en: "Bottom-right corner (text aligns right, baseline bottom).", ru: "Правый нижний угол (текст по правому краю, базовая линия снизу)." },
          { name: "Window.bottom", type: "AnchorPoint", en: "Bottom center (text centered, baseline bottom).", ru: "Нижний центр (текст по центру, базовая линия снизу)." },
          { name: "Window.left", type: "AnchorPoint", en: "Left center (text aligns right, baseline middle).", ru: "Левый центр (текст по правому краю, базовая линия по середине)." },
          { name: "Window.right", type: "AnchorPoint", en: "Right center (text aligns left, baseline middle).", ru: "Правый центр (текст по левому краю, базовая линия по середине)." },
          { name: "Window.center", type: "AnchorPoint", en: "Canvas center (text centered both ways).", ru: "Центр холста (текст по центру в обоих направлениях)." },
        ],
      },
      {
        id: "anchor_point",
        name: "AnchorPoint",
        signature: "AnchorPoint(x, y, h_align, v_align)",
        en: "Represents a position with alignment hints. Returned by Window.<edge> and actor.<edge> properties. Pass it to text() or say(). x and y can be callables (for dynamic positions) or plain numbers.",
        ru: "Представляет позицию с подсказками о выравнивании. Возвращается свойствами Window.<edge> и actor.<edge>. Передайте его в text() или say(). x и y могут быть функциями (для динамических позиций) или числами.",
        params: [
          { name: "x", type: "number | callable", en: "X coordinate or a lambda returning it.", ru: "Координата X или лямбда, её возвращающая." },
          { name: "y", type: "number | callable", en: "Y coordinate or a lambda returning it.", ru: "Координата Y или лямбда, её возвращающая." },
          { name: "h_align", type: "str", optional: true, default: '"left"', en: '"left", "center", or "right".', ru: '"left", "center" или "right".' },
          { name: "v_align", type: "str", optional: true, default: '"top"', en: '"top", "middle", or "bottom".', ru: '"top", "middle" или "bottom".' },
        ],
      },
    ],
  },

  // ─── Input ─────────────────────────────────────────────────────────────────
  {
    id: "input",
    en: "Input",
    ru: "Управление",
    entries: [
      {
        id: "mouse",
        name: "Mouse",
        signature: "Mouse",
        en: "The current mouse state. Mouse.x/Mouse.y are the canvas coordinates. Mouse.down is true while a button is held, Mouse.pressed is true only on the first frame of a click, Mouse.released is true only on the frame the button is let go.",
        ru: "Текущее состояние мыши. Mouse.x/Mouse.y — координаты на холсте. Mouse.down — кнопка удерживается, Mouse.pressed — только в первый кадр клика, Mouse.released — только в кадр отпускания.",
        params: [
          { name: "Mouse.x", type: "number", en: "Current X position on the canvas.", ru: "Текущая координата X на холсте." },
          { name: "Mouse.y", type: "number", en: "Current Y position on the canvas.", ru: "Текущая координата Y на холсте." },
          { name: "Mouse.down", type: "bool", en: "True while any mouse button is held.", ru: "True, пока удерживается любая кнопка мыши." },
          { name: "Mouse.pressed", type: "bool", en: "True only on the first frame of a click.", ru: "True только в первый кадр нажатия." },
          { name: "Mouse.released", type: "bool", en: "True only on the frame the button is released.", ru: "True только в кадр отпускания кнопки." },
        ],
      },
      {
        id: "keyboard",
        name: "Keyboard",
        signature: "Keyboard.<key>  /  Keyboard[\"key\"]",
        en: "Check keyboard state. Access keys as attributes (Keyboard.space, Keyboard.arrow_left, Keyboard.a) or by string (Keyboard[\"1\"]). Each key object has .down, .pressed, and .released.",
        ru: "Проверка состояния клавиатуры. Доступ к клавишам через атрибут (Keyboard.space, Keyboard.arrow_left, Keyboard.a) или строку (Keyboard[\"1\"]). У каждой клавиши есть .down, .pressed и .released.",
        params: [
          { name: ".down", type: "bool", en: "True while the key is held.", ru: "True, пока клавиша удерживается." },
          { name: ".pressed", type: "bool", en: "True only on the first frame the key is pressed.", ru: "True только в первый кадр нажатия клавиши." },
          { name: ".released", type: "bool", en: "True only on the frame the key is released.", ru: "True только в кадр отпускания клавиши." },
        ],
      },
      {
        id: "keyboard_keys",
        name: "Key names",
        signature: "Keyboard.<key>",
        en: "Arrow keys: arrow_left, arrow_right, arrow_up, arrow_down. Special: space, escape, enter, backspace, tab, shift, ctrl, alt. Letters: a–z. Number keys: key_0–key_9 (use the prefix because Keyboard.0 is not valid Python), or Keyboard[\"0\"]–Keyboard[\"9\"] with string syntax.",
        ru: "Стрелки: arrow_left, arrow_right, arrow_up, arrow_down. Спецклавиши: space, escape, enter, backspace, tab, shift, ctrl, alt. Буквы: a–z. Цифровые клавиши: key_0–key_9 (с префиксом, так как Keyboard.0 — не валидный Python), или Keyboard[\"0\"]–Keyboard[\"9\"] через строку.",
      },
    ],
  },

  // ─── Actors ────────────────────────────────────────────────────────────────
  {
    id: "actors",
    en: "Actors",
    ru: "Акторы",
    entries: [
      {
        id: "actor_class",
        name: "Actor",
        signature: "Actor(**kwargs)",
        en: "Base class for game objects. Pass initial values as keyword arguments. Subclass it and define init() and/or update() to add custom behaviour.",
        ru: "Базовый класс для игровых объектов. Начальные значения передаются именованными аргументами. Наследуйте его и определите init() и/или update() для добавления собственного поведения.",
        params: [
          { name: "x", type: "number", optional: true, default: "0", en: "Horizontal center position.", ru: "Горизонтальная позиция центра." },
          { name: "y", type: "number", optional: true, default: "0", en: "Vertical center position.", ru: "Вертикальная позиция центра." },
          { name: "angle", type: "number", optional: true, default: "0", en: "Rotation in degrees. Purely visual — affects draw() rotation and actor.move(distance). To move at an angle automatically, set actor.vel = Polar(speed, angle).", ru: "Угол поворота в градусах. Чисто визуальный — влияет на отрисовку и actor.move(distance). Для автоматического движения под углом задайте actor.vel = Polar(speed, angle)." },
          { name: "vx", type: "number", optional: true, default: "0", en: "Horizontal velocity (pixels per frame, applied automatically).", ru: "Горизонтальная скорость (пикселей в кадр, применяется автоматически)." },
          { name: "vy", type: "number", optional: true, default: "0", en: "Vertical velocity (pixels per frame, applied automatically).", ru: "Вертикальная скорость (пикселей в кадр, применяется автоматически)." },
          { name: "pos", type: "Vector2", en: "Position as a Vector2. Reading returns a fresh vector; assigning sets x and y. Useful for math: actor.pos += Vector2(0, 1).", ru: "Позиция как Vector2. Чтение возвращает новый вектор; присваивание устанавливает x и y. Удобно для математики: actor.pos += Vector2(0, 1)." },
          { name: "vel", type: "Vector2", en: "Velocity as a Vector2 (pairs with pos). Set with Polar(speed, angle) for movement at an angle: bullet.vel = Polar(8, ship.angle).", ru: "Скорость как Vector2 (пара к pos). Используйте Polar(speed, angle) для движения под углом: bullet.vel = Polar(8, ship.angle)." },
          { name: "image", type: "sprite", optional: true, en: "Sprite from assets.sprites.", ru: "Спрайт из assets.sprites." },
          { name: "visible", type: "bool", optional: true, default: "True", en: "Whether the actor is drawn.", ru: "Отображается ли актор." },
        ],
      },
      {
        id: "actor_methods",
        name: "Actor methods",
        signature: "actor.method()",
        en: "Methods available on every Actor.",
        ru: "Методы, доступные каждому актору.",
        params: [
          { name: "move(distance)", type: "—", en: "One-shot step: move forward by distance in the direction of angle (using the visual rotation). Useful when you want a per-frame imperative step instead of a continuous velocity. For continuous motion at an angle, set actor.vel = Polar(distance_per_frame, angle).", ru: "Одношаговое движение: сместиться вперёд на distance в направлении угла (по визуальному повороту). Подходит, когда нужен императивный шаг каждый кадр, а не постоянная скорость. Для непрерывного движения под углом задайте actor.vel = Polar(скорость_за_кадр, angle)." },
          { name: "move_to(x, y)", type: "—", en: "Jump directly to position (x, y).", ru: "Переместиться напрямую в позицию (x, y)." },
          { name: "change_x_by(dx)", type: "—", en: "Add dx to the x position.", ru: "Добавить dx к позиции x." },
          { name: "change_y_by(dy)", type: "—", en: "Add dy to the y position.", ru: "Добавить dy к позиции y." },
          { name: "rotate(degrees)", type: "—", en: "Turn by the given number of degrees.", ru: "Повернуть на заданное число градусов." },
          { name: "point_towards(x, y)", type: "—", en: "Rotate to face position (x, y).", ru: "Повернуться лицом к позиции (x, y)." },
          { name: "draw()", type: "—", en: "Draw this actor on the canvas.", ru: "Нарисовать этот актор на холсте." },
          { name: "update()", type: "—", en: "Called automatically each frame by the game loop before main(). Override in subclass to add per-actor logic without writing it inside main().", ru: "Вызывается автоматически каждый кадр игровым циклом до main(). Переопределите в подклассе, чтобы добавить логику актора без написания кода внутри main()." },
          { name: "die()", type: "—", en: "Remove this actor from the game.", ru: "Удалить этот актор из игры." },
          { name: "is_alive()", type: "bool", en: "True if the actor has not been removed.", ru: "True, если актор не был удалён." },
          { name: "collides_with(other)", type: "bool", en: "True if this actor's collider overlaps other's. Both must have a collider configured.", ru: "True, если коллайдер этого актора перекрывается с другим. Оба должны иметь настроенный коллайдер." },
          { name: "collides_any(group)", type: "Actor|None", en: "Returns the first actor in group this actor overlaps, or None.", ru: "Возвращает первый актор из group, с которым есть перекрытие, или None." },
          { name: "future_state", type: "ActorSnapshot", en: "One-frame lookahead. actor.future_state.collides_any(walls) returns the wall the actor will hit next frame, without moving the actor. Use to stop motion before a collision: if player.future_state.collides_any(walls): player.vel = (0, 0).", ru: "Снимок состояния через один кадр. actor.future_state.collides_any(walls) возвращает стену, в которую актор столкнётся в следующем кадре, не двигая его. Используйте, чтобы остановить движение до столкновения: if player.future_state.collides_any(walls): player.vel = (0, 0)." },
        ],
      },
      {
        id: "actor_collider",
        name: "Collider",
        signature: "actor.collider",
        en: "Each actor has a collider that defines its hitbox. Rect and Circle actors configure their colliders automatically. For a base Actor (or to override the shape), call set_circle or set_rect. Without a collider shape, collides_with always returns False.",
        ru: "У каждого актора есть коллайдер, определяющий его хитбокс. Акторы Rect и Circle настраивают коллайдеры автоматически. Для базового Actor (или чтобы переопределить форму) вызовите set_circle или set_rect. Без формы коллайдера collides_with всегда возвращает False.",
        params: [
          { name: "collider.set_circle(r, dx=0, dy=0)", type: "—", en: "Set a circular hitbox with radius r. dx/dy offset the hitbox from the actor's center.", ru: "Устанавливает круглый хитбокс радиуса r. dx/dy смещают хитбокс от центра актора." },
          { name: "collider.set_rect(w, h, dx=0, dy=0)", type: "—", en: "Set a rectangular hitbox of size w×h. dx/dy offset the hitbox.", ru: "Устанавливает прямоугольный хитбокс размером w×h. dx/dy смещают хитбокс." },
          { name: "collider.disable()", type: "—", en: "Remove the hitbox (actor becomes non-collidable).", ru: "Убирает хитбокс (актор перестаёт участвовать в столкновениях)." },
          { name: "collider.shape", type: "str|None", en: '"circle", "rect", or None when no hitbox is set.', ru: '"circle", "rect" или None, если хитбокс не задан.' },
          { name: "collider.active_x / active_y", type: "number", en: "The hitbox center, accounting for dx/dy offset.", ru: "Центр хитбокса с учётом смещения dx/dy." },
          { name: "actor.collidable", type: "bool", en: "True if the collider has a shape set.", ru: "True, если коллайдер имеет заданную форму." },
        ],
      },
      {
        id: "actor_spatial",
        name: "Spatial helpers",
        signature: "actor.random_position() / actor.wrap() / actor.in_bounds()",
        en: "Helpers for placing and moving actors relative to the canvas boundaries.",
        ru: "Вспомогательные методы для размещения и перемещения акторов относительно границ холста.",
        params: [
          { name: "random_position()", type: "—", en: "Teleport so the actor is fully inside the canvas. Uses the collider shape for margin (circle radius or half-rect size), so the actor never sticks out. Falls back to any position on a bare Actor.", ru: "Телепортирует актора так, чтобы он полностью находился внутри холста. Использует форму коллайдера для отступа (радиус круга или половина прямоугольника). У базового Actor — любая позиция." },
          { name: "wrap_x()", type: "—", en: "If the actor leaves the left or right edge, it appears on the opposite side.", ru: "Если актор выходит за левый или правый край, он появляется с противоположной стороны." },
          { name: "wrap_y()", type: "—", en: "Same as wrap_x() but for top and bottom edges.", ru: "То же, что wrap_x(), но для верхнего и нижнего краёв." },
          { name: "wrap()", type: "—", en: "Wrap in both directions at once.", ru: "Перенос в обоих направлениях одновременно." },
          { name: "in_bounds()", type: "bool", en: "True if the actor's center is within the canvas (0 ≤ x ≤ width, 0 ≤ y ≤ height).", ru: "True, если центр актора находится внутри холста (0 ≤ x ≤ width, 0 ≤ y ≤ height)." },
        ],
      },
      {
        id: "actor_anchors",
        name: "Actor anchor points",
        signature: "actor.<edge>",
        en: "Each actor exposes AnchorPoints at its edges. Size precedence: an explicit collider (Circle radius, Rect half-size) wins; otherwise the actor's sprite (`image`) dimensions are used; a bare Actor with no image returns its center for all anchors. AnchorPoints behave as Vector2 (arithmetic, equality, distance_to), so you can pass them to tile_at() or do math directly.",
        ru: "Каждый актор предоставляет AnchorPoint у своих краёв. Приоритет размеров: явный коллайдер (радиус Circle, половина размеров Rect); иначе — размеры спрайта (`image`); базовый Actor без изображения возвращает свой центр для всех якорей. AnchorPoint ведёт себя как Vector2 (арифметика, равенство, distance_to), его можно передавать в tile_at() или использовать в математике напрямую.",
        params: [
          { name: "actor.center", type: "AnchorPoint", en: "Center of the actor.", ru: "Центр актора." },
          { name: "actor.top", type: "AnchorPoint", en: "Top edge center. Use with say() or text() to place content above the actor.", ru: "Центр верхнего края. Используйте с say() или text(), чтобы разместить контент над актором." },
          { name: "actor.bottom", type: "AnchorPoint", en: "Bottom edge center.", ru: "Центр нижнего края." },
          { name: "actor.left", type: "AnchorPoint", en: "Left edge center.", ru: "Центр левого края." },
          { name: "actor.right", type: "AnchorPoint", en: "Right edge center.", ru: "Центр правого края." },
          { name: "actor.top_left", type: "AnchorPoint", en: "Top-left corner.", ru: "Левый верхний угол." },
          { name: "actor.top_right", type: "AnchorPoint", en: "Top-right corner.", ru: "Правый верхний угол." },
          { name: "actor.bottom_left", type: "AnchorPoint", en: "Bottom-left corner.", ru: "Левый нижний угол." },
          { name: "actor.bottom_right", type: "AnchorPoint", en: "Bottom-right corner.", ru: "Правый нижний угол." },
        ],
      },
      {
        id: "actor_static",
        name: "Actor class helpers",
        signature: "Actor.all_actors()  /  Actor.random_coords()",
        en: "Class-level helpers.",
        ru: "Вспомогательные методы класса.",
        params: [
          { name: "Actor.all_actors()", type: "list", en: "Returns a list of every living actor.", ru: "Возвращает список всех живых акторов." },
          { name: "Actor.random_coords()", type: "(x, y)", en: "Returns a random (x, y) within the canvas (does not account for actor size). Prefer actor.random_position() when you want the full body inside the canvas.", ru: "Возвращает случайную (x, y) в пределах холста (не учитывает размер актора). Предпочтите actor.random_position(), если нужно, чтобы тело актора полностью находилось внутри." },
        ],
      },
      {
        id: "rect_actor",
        name: "Rect",
        signature: "Rect(x, y, width, height, color, stroke_color, stroke_width)",
        en: "A rectangle actor that draws itself. Automatically sets a rect collider matching its size. The color parameter accepts a color name string, a Colors.* tuple, or an RGB tuple.",
        ru: "Актор-прямоугольник, который рисует себя. Автоматически устанавливает прямоугольный коллайдер, соответствующий его размеру. Параметр color принимает строку с названием цвета, кортеж Colors.* или кортеж RGB.",
        params: [
          { name: "x", type: "number", optional: true, default: "0", en: "Center X.", ru: "Координата X центра." },
          { name: "y", type: "number", optional: true, default: "0", en: "Center Y.", ru: "Координата Y центра." },
          { name: "width", type: "number", optional: true, default: "60", en: "Rectangle width.", ru: "Ширина прямоугольника." },
          { name: "height", type: "number", optional: true, default: "40", en: "Rectangle height.", ru: "Высота прямоугольника." },
          { name: "color", type: "str | tuple", optional: true, default: '"white"', en: "Fill color (name, Colors.*, or RGB tuple).", ru: "Цвет заливки (название, Colors.* или кортеж RGB)." },
          { name: "stroke_color", type: "str | tuple", optional: true, en: "Outline color. No outline if omitted.", ru: "Цвет обводки. Без обводки, если не указан." },
          { name: "stroke_width", type: "number", optional: true, default: "0", en: "Outline thickness in pixels.", ru: "Толщина обводки в пикселях." },
        ],
      },
      {
        id: "circle_actor",
        name: "Circle",
        signature: "Circle(x, y, radius, color, stroke_color, stroke_width)",
        en: "A circle actor that draws itself. Automatically sets a circle collider with the given radius.",
        ru: "Актор-круг, который рисует себя. Автоматически устанавливает круглый коллайдер с заданным радиусом.",
        params: [
          { name: "x", type: "number", optional: true, default: "0", en: "Center X.", ru: "Координата X центра." },
          { name: "y", type: "number", optional: true, default: "0", en: "Center Y.", ru: "Координата Y центра." },
          { name: "radius", type: "number", optional: true, default: "30", en: "Radius (also used as the collider radius).", ru: "Радиус (также используется как радиус коллайдера)." },
          { name: "color", type: "str | tuple", optional: true, default: '"white"', en: "Fill color (name, Colors.*, or RGB tuple).", ru: "Цвет заливки (название, Colors.* или кортеж RGB)." },
          { name: "stroke_color", type: "str | tuple", optional: true, en: "Outline color. No outline if omitted.", ru: "Цвет обводки. Без обводки, если не указан." },
          { name: "stroke_width", type: "number", optional: true, default: "0", en: "Outline thickness in pixels.", ru: "Толщина обводки в пикселях." },
        ],
      },
      {
        id: "group",
        name: "Group",
        signature: "Group()",
        en: "A collection of actors that is safe to iterate even while actors are dying. Dead actors are filtered out automatically on each iteration.",
        ru: "Коллекция акторов, по которой безопасно итерировать даже при гибели акторов. Мёртвые акторы автоматически исключаются при каждой итерации.",
        params: [
          { name: "add(actor)", type: "—", en: "Add an actor to the group.", ru: "Добавить актор в группу." },
          { name: "remove(actor)", type: "—", en: "Remove an actor from the group.", ru: "Удалить актор из группы." },
          { name: "len(group)", type: "number", en: "Number of actors in the group (including recently dead ones until next iteration).", ru: "Количество акторов в группе (включая недавно погибших до следующей итерации)." },
        ],
      },
    ],
  },

  // ─── Tilemap ───────────────────────────────────────────────────────────────
  {
    id: "tilemap",
    en: "Tilemap",
    ru: "Тайловая карта",
    entries: [
      {
        id: "assets_tilemaps",
        name: "assets.tilemaps",
        signature: "assets.tilemaps.<name>",
        en: "Access a project tilemap by name. Returns a TileMap object containing all of its layers. The tilemap must be created in the sprite editor and added to the project first.",
        ru: "Доступ к тайловой карте проекта по имени. Возвращает объект TileMap со всеми его слоями. Тайловая карта должна быть предварительно создана в редакторе спрайтов.",
        params: [
          { name: "name", type: "str", en: "Tilemap name as set in the editor, e.g. assets.tilemaps.level1.", ru: "Имя тайловой карты из редактора, например assets.tilemaps.level1." },
        ],
        returns: { type: "TileMap", en: "A TileMap object.", ru: "Объект TileMap." },
      },
      {
        id: "tilemap_class",
        name: "TileMap",
        signature: "tilemap.draw(x=0, y=0)",
        en: "A collection of named TilemapLayers drawn bottom-to-top. Call draw() each frame to render all layers at an offset — useful for scrolling.",
        ru: "Набор именованных слоёв тайловой карты, рисуемых снизу вверх. Вызывайте draw() каждый кадр для отрисовки всех слоёв со смещением — удобно для прокрутки.",
        params: [
          { name: "draw(x=0, y=0)", type: "—", en: "Draw all layers at pixel offset (x, y). Tiles outside the canvas are skipped automatically.", ru: "Рисует все слои со смещением (x, y) в пикселях. Тайлы за пределами холста автоматически пропускаются." },
          { name: "layers", type: "dict", en: 'Dict of layer name → TilemapLayer. Access a specific layer with tilemap.layers["Layer 1"].', ru: 'Словарь имя слоя → TilemapLayer. Доступ к слою: tilemap.layers["Layer 1"].' },
          { name: "tag / all_tiles", type: "—", en: 'See the "Tile tags" entry below for the tag-and-query workflow shared by TileMap and TilemapLayer.', ru: 'См. запись "Tile tags" ниже — общий рабочий процесс пометки и запроса для TileMap и TilemapLayer.' },
        ],
      },
      {
        id: "tilemap_tags",
        name: "Tile tags",
        signature: 'level.tag(tile_name, *tags)  →  level.all_tiles(tag) → Group',
        en: 'Label tiles by name, then ask the tilemap for a Group of colliders for every cell with that label. Use the Group for collisions, just like Actors.',
        ru: 'Пометьте тайлы по имени, затем получите Group коллайдеров для всех ячеек с этой меткой. Group работает в коллизиях так же, как с актёрами.',
        example: 'level.tag("brick", "wall")\nwalls = level.all_tiles("wall")\n\nif player.collides_any(walls):\n    player.stop()',
        advanced: {
          en: 'Pass merge=True to all_tiles to greedily collapse adjacent tagged cells into larger rectangles — a 30-tile wall stripe becomes 1 rectangle. This is the form to feed into Light.add_obstacles, because the light raycaster is O(N²) per source. Multiple tags per call are allowed and idempotent (set semantics). TileMap.tag/all_tiles work across every layer; TilemapLayer.tag/all_tiles work on a single layer. An unknown tag returns an empty Group — safe to iterate. The returned TileRef actors skip Actor.all_actors() — they exist only as collision shapes, the tilemap itself draws the pixels. The Group is cached per (tag, merge) pair until tags change.',
          ru: 'Передайте merge=True в all_tiles, чтобы жадно объединить соседние помеченные ячейки в большие прямоугольники — стена из 30 тайлов превращается в 1 прямоугольник. Именно такую Group передавайте в Light.add_obstacles, потому что raycaster света имеет сложность O(N²) на источник. Несколько меток за вызов допустимы и идемпотентны (семантика множества). TileMap.tag/all_tiles работают по всем слоям; TilemapLayer.tag/all_tiles — по одному слою. Неизвестная метка возвращает пустую Group — безопасно итерировать. Возвращаемые TileRef не входят в Actor.all_actors() — они существуют только как формы для коллизий, пиксели рисует сам tilemap. Group кэшируется по паре (tag, merge) до изменения меток.',
        },
        params: [
          { name: "tile_name", type: "str", en: 'Name of the tile to tag, as used in the sprite editor.', ru: 'Имя тайла из редактора спрайтов.' },
          { name: "*tags", type: "str", en: 'One or more labels to attach. Duplicates are ignored.', ru: 'Одна или несколько меток. Дубликаты игнорируются.' },
          { name: "tag", type: "str", en: 'Label to look up in all_tiles().', ru: 'Метка для поиска в all_tiles().' },
          { name: "merge", type: "bool", default: "False", en: 'Combine adjacent cells into bigger rectangles. See Advanced.', ru: 'Объединять соседние ячейки в большие прямоугольники. См. Подробнее.' },
        ],
        returns: { type: 'Group', en: 'Tile colliders for collides_any() / Light.add_obstacles.', ru: 'Коллайдеры тайлов для collides_any() / Light.add_obstacles.' },
      },
      {
        id: "tilemap_layer_class",
        name: "TilemapLayer",
        signature: "layer.draw(x=0, y=0)",
        en: "A single named layer from a TileMap. Contains a sparse grid of tile names mapped to ImageBitmaps from the project assets. You can draw individual layers and query tiles by position.",
        ru: "Один именованный слой тайловой карты. Содержит разрежённую сетку из имён тайлов, привязанных к изображениям из ассетов проекта. Можно рисовать отдельные слои и получать тайлы по позиции.",
        params: [
          { name: "draw(x=0, y=0)", type: "—", en: "Draw this layer at pixel offset (x, y).", ru: "Рисует этот слой со смещением (x, y) в пикселях." },
          { name: "tile_at(px, py)", type: "str|None", en: "Return the tile name at pixel position (px, py), or None if empty. Also accepts a single Vector2/Point/AnchorPoint: tile_at(player.bottom).", ru: "Возвращает имя тайла в пиксельной позиции (px, py) или None, если ячейка пустая. Также принимает один Vector2/Point/AnchorPoint: tile_at(player.bottom)." },
          { name: "get_tile(col, row)", type: "str|None", en: "Return the tile name at grid column/row, or None if empty.", ru: "Возвращает имя тайла по координатам столбца и строки сетки или None, если ячейка пустая." },
          { name: "tiles()", type: "generator", en: "Yield (col, row, name) for every filled cell in the layer.", ru: "Генерирует (col, row, name) для каждой заполненной ячейки слоя." },
          { name: 'tag / all_tiles', type: '—', en: 'See the "Tile tags" entry — the same API works on a single layer.', ru: 'См. запись "Tile tags" — тот же API работает и на одном слое.' },
          { name: "name", type: "str", en: "The layer's name as set in the editor.", ru: "Имя слоя из редактора." },
          { name: "tile_size", type: "number", en: "Tile size in pixels (all tiles in a layer are the same size).", ru: "Размер тайла в пикселях (все тайлы в слое одного размера)." },
        ],
      },
    ],
  },

  // ─── Themes & Lighting ─────────────────────────────────────────────────────
  {
    id: "themes_lighting",
    en: "Themes & Lighting",
    ru: "Темы и освещение",
    entries: [
      {
        id: "themes_namespace",
        name: "Themes",
        signature: "Themes.<name>.<color>",
        en: 'Named color themes. Each theme exposes the same color names as Colors but with different RGB values, plus ambient and light_shade for lighting integration. Built-in themes: "default", "summer", "dungeon", "moonlit". Use anywhere a color is accepted, e.g. fill(Themes.summer.green). Themes.current resolves at access time to the project\'s active theme (chosen in the sprite editor).',
        ru: 'Именованные цветовые темы. Каждая тема предоставляет тот же набор имён цветов, что и Colors, но с другими значениями RGB, а также поля ambient и light_shade для освещения. Встроенные темы: "default", "summer", "dungeon", "moonlit". Используйте везде, где принимается цвет: fill(Themes.summer.green). Themes.current разрешается во время доступа в активную тему проекта (выбирается в редакторе спрайтов).',
        params: [
          { name: 'Themes.<name>', type: '_Theme', en: 'A theme object. Access its colors as Themes.dungeon.red, ambient as Themes.dungeon.ambient, light shade as Themes.dungeon.light_shade.', ru: 'Объект темы. Доступ к цветам: Themes.dungeon.red, к ambient: Themes.dungeon.ambient, к свету: Themes.dungeon.light_shade.' },
          { name: 'Themes.current', type: '_Theme', en: 'The project\'s active theme. Lazy — do not store in a long-lived variable if the theme can change.', ru: 'Активная тема проекта. Динамическая — не сохраняйте в долгоживущей переменной, если тема может меняться.' },
        ],
      },
      {
        id: "light_class",
        name: "Light",
        signature: "Light(ambient=(40,40,60), radius=200)",
        en: "Multiply-blended lighting overlay with optional shadow-casting sources. Add obstacles (walls, tiles) and sources (torches, the player), then call light.draw() last each frame so the lightmap composites over everything else. Visibility polygons are cached automatically: a source's polygon is only recomputed when its position or radius changes, or when any obstacle moves or resizes. A fully static scene pays the raycasting cost on the first frame and reuses the polygons afterwards — combine with all_tiles(\"wall\", merge=True) for tile-map lighting that holds 60fps.",
        ru: "Освещение с мультипликативным наложением и поддержкой теней. Добавьте препятствия (стены, тайлы) и источники (факелы, игрока), затем вызывайте light.draw() последним в каждом кадре, чтобы карта света наложилась поверх остального. Полигоны видимости кэшируются автоматически: полигон источника пересчитывается только при изменении его позиции/радиуса или при движении/изменении препятствий. Полностью статичная сцена платит за raycasting только в первом кадре, затем переиспользует полигоны — в связке с all_tiles(\"wall\", merge=True) подземелье держит 60fps.",
        params: [
          { name: 'ambient', type: 'tuple', optional: true, default: '(40,40,60)', en: 'Ambient RGB applied where no source reaches. Use Themes.<name>.ambient for a themed ambient.', ru: 'Окружающий RGB там, куда не достаёт источник. Используйте Themes.<name>.ambient для тематического значения.' },
          { name: 'radius', type: 'number', optional: true, default: '200', en: 'Default light radius in pixels for sources.', ru: 'Радиус источника света в пикселях по умолчанию.' },
        ],
      },
      {
        id: "light_methods",
        name: "Light methods",
        signature: "light.method()",
        en: "All setter methods return self so calls can be chained: Light().add_source(torch).shade('warm').flicker(True).",
        ru: "Все методы-сеттеры возвращают self для цепочечных вызовов: Light().add_source(torch).shade('warm').flicker(True).",
        params: [
          { name: 'add_source(actor_or_group_or_pos)', type: 'Light', en: 'Register a light source — an Actor (e.g. torch), a Group of actors, or a position tuple/Vector2.', ru: 'Регистрирует источник света — Actor (например, факел), Group акторов или кортеж/Vector2 позиции.' },
          { name: 'add_obstacles(group)', type: 'Light', en: 'Register obstacles that cast shadows. Pass any iterable (Group, list, all_tiles result) or a single Actor.', ru: 'Регистрирует препятствия, отбрасывающие тени. Принимает любой итерируемый объект (Group, list, all_tiles) или одного Actor.' },
          { name: 'add_obst(actor)', type: 'Light', en: 'Alias of add_obstacles.', ru: 'Алиас add_obstacles.' },
          { name: "shade(name)", type: 'Light', en: 'Set the light gradient color by named shade. Available: "neutral", "warm", "cool", "moonlight", "candle". Raises ValueError on unknown names.', ru: 'Устанавливает цвет градиента света по имени. Доступно: "neutral", "warm", "cool", "moonlight", "candle". Незнакомое имя — ValueError.' },
          { name: 'flicker(enabled=True)', type: 'Light', en: 'Toggle fire-like intensity jitter in [0.85, 1.0], derived deterministically from frame_count + per-light seed.', ru: 'Включает дрожание интенсивности (как у огня) в диапазоне [0.85, 1.0], детерминированно по frame_count + сиду источника.' },
          { name: 'radius(r)', type: 'Light', en: 'Change the default radius for new sources.', ru: 'Меняет радиус по умолчанию для новых источников.' },
          { name: 'style(theme)', type: 'Light', en: 'Set ambient + shade from a theme. Accepts a Themes.<name> object or a theme-name string. Example: light.style("dungeon").', ru: 'Устанавливает ambient + shade из темы. Принимает объект Themes.<name> или строку с именем темы. Пример: light.style("dungeon").' },
          { name: 'draw()', type: '—', en: 'Emit the lighting overlay for this frame. Call this LAST in main(), after all other drawing, so the lightmap composites on top.', ru: 'Рисует накладку освещения для этого кадра. Вызывайте ПОСЛЕДНЕЙ в main() после всех остальных draw-вызовов, чтобы карта света наложилась поверх.' },
        ],
      },
    ],
  },

  // ─── Utilities ─────────────────────────────────────────────────────────────
  {
    id: "utils",
    en: "Utilities",
    ru: "Утилиты",
    entries: [
      {
        id: "random_fn",
        name: "random",
        signature: "random(low, high)",
        en: "Return a random float. With one argument, returns a value in [0, low). With two arguments, returns a value in [low, high).",
        ru: "Возвращает случайное число с плавающей точкой. С одним аргументом — в диапазоне [0, low). С двумя — в диапазоне [low, high).",
        params: [
          { name: "low", type: "number", en: "Lower bound (or upper bound if high is omitted).", ru: "Нижняя граница (или верхняя, если high не указан)." },
          { name: "high", type: "number", optional: true, en: "Upper bound.", ru: "Верхняя граница." },
        ],
        returns: { type: "float", en: "A random float.", ru: "Случайное число с плавающей точкой." },
      },
      {
        id: "random_color",
        name: "random_color",
        signature: "random_color()",
        en: "Return a random color tuple from the Colors palette. The returned value can be passed directly to fill(), stroke(), or background().",
        ru: "Возвращает случайный кортеж цвета из палитры Colors. Результат можно напрямую передать в fill(), stroke() или background().",
        returns: { type: "tuple", en: "An (R, G, B) color tuple.", ru: "Кортеж цвета (R, G, B)." },
      },
      {
        id: "assets_sprites",
        name: "assets.sprites",
        signature: "assets.sprites.<name>",
        en: "Access a project sprite by filename without extension. The sprite must be added to the project first via the Assets panel.",
        ru: "Доступ к спрайту проекта по имени файла без расширения. Спрайт должен быть предварительно добавлен через панель Ассеты.",
        params: [
          { name: "name", type: "str", en: "Filename without extension, e.g. assets.sprites.ship for ship.svg.", ru: "Имя файла без расширения, например assets.sprites.ship для ship.svg." },
        ],
      },
      {
        id: "assets_animations",
        name: "assets.animations",
        signature: "assets.animations.<name>",
        en: "Access a project animation by name. Returns an Animation object whose frames are the drawings from the Animations panel. Call update() each frame and draw animation.frame with image().",
        ru: "Доступ к анимации проекта по имени. Возвращает объект Animation, кадры которого — рисунки из панели Анимации. Каждый кадр вызывайте update() и рисуйте animation.frame с помощью image().",
        params: [
          { name: "name", type: "str", en: "Animation name as set in the Animations panel, e.g. assets.animations.walk.", ru: "Имя анимации из панели Анимации, например assets.animations.walk." },
        ],
      },
    ],
  },

  // ─── Sprite Animation ──────────────────────────────────────────────────────
  {
    id: "sprite_animation",
    en: "Sprite Animation",
    ru: "Покадровая анимация",
    entries: [
      {
        id: "animation_class",
        name: "Animation",
        signature: "Animation(frames, fps=8)",
        en: "A frame-cycling sprite animation. Pass a list of sprite frames and the playback speed. Call update() every frame to advance the timer, then draw animation.frame with image(). Create animations in the Animations panel — they load automatically as assets.animations.<name>.",
        ru: "Покадровая спрайтовая анимация. Передайте список кадров и скорость воспроизведения. Вызывайте update() каждый кадр для продвижения таймера, затем рисуйте animation.frame с помощью image(). Создавайте анимации в панели Анимации — они загружаются автоматически как assets.animations.<name>.",
        params: [
          { name: "frames", type: "list", en: "List of sprite frames (e.g. from assets.animations.walk.frame or custom list).", ru: "Список кадров спрайта." },
          { name: "fps", type: "number", optional: true, default: "8", en: "Playback speed in frames per second.", ru: "Скорость воспроизведения в кадрах в секунду." },
        ],
      },
      {
        id: "animation_update",
        name: "animation.update",
        signature: "animation.update()",
        en: "Advance the animation timer by one game frame. Must be called once per frame inside main() to move between sprite frames.",
        ru: "Продвигает таймер анимации на один игровой кадр. Нужно вызывать один раз за кадр внутри main() для смены кадров спрайта.",
      },
      {
        id: "animation_frame",
        name: "animation.frame",
        signature: "animation.frame",
        en: "The current sprite frame. Pass directly to image() to draw it. Returns None if the animation has no frames.",
        ru: "Текущий кадр спрайта. Передайте напрямую в image() для отрисовки. Возвращает None, если у анимации нет кадров.",
        returns: { type: "sprite", en: "Current frame sprite, or None.", ru: "Текущий кадр-спрайт, или None." },
      },
      {
        id: "animation_play",
        name: "animation.play / pause / reset",
        signature: "animation.play()  animation.pause()  animation.reset()",
        en: "Control playback. play() resumes, pause() freezes on the current frame, reset() jumps back to frame 0 and resumes.",
        ru: "Управление воспроизведением. play() возобновляет, pause() замораживает на текущем кадре, reset() переходит к кадру 0 и возобновляет.",
      },
      {
        id: "animation_loop",
        name: "animation.loop",
        signature: "animation.loop = True",
        en: "Whether the animation loops back to frame 0 after the last frame. Set to False to hold on the last frame when done.",
        ru: "Зацикливать ли анимацию после последнего кадра. Установите False, чтобы остановиться на последнем кадре.",
      },
      {
        id: "animation_done",
        name: "animation.done",
        signature: "animation.done",
        en: "True when a non-looping animation has finished playing and is holding on the last frame.",
        ru: "True, когда незацикленная анимация завершила воспроизведение и остановилась на последнем кадре.",
        returns: { type: "bool", en: "True if finished.", ru: "True, если завершена." },
      },
    ],
  },
];
