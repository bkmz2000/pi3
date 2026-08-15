export type DocRecipeSection =
  | "drawing"
  | "actors"
  | "animation"
  | "input"
  | "sound"
  | "tilemaps"
  | "window_utils"
  | "camera"
  | "transforms"
  | "color"
  | "procedural"
  | "debugging";

export type DocRecipe = {
  id: string;
  section: DocRecipeSection;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  en: { title: string; intro: string };
  ru: { title: string; intro: string };
  // IDs from DOCS entries (graphicsDocs.ts), in the order a learner should read them.
  entryIds: string[];
};

export const RECIPE_SECTIONS: { id: DocRecipeSection; en: string; ru: string }[] = [
  { id: "drawing",      en: "Drawing basics",      ru: "Основы рисования" },
  { id: "actors",       en: "Actors",              ru: "Актёры" },
  { id: "animation",    en: "Animation",           ru: "Анимация" },
  { id: "input",        en: "Movement & input",    ru: "Движение и ввод" },
  { id: "sound",        en: "Sound",               ru: "Звук" },
  { id: "tilemaps",     en: "Tilemaps",            ru: "Тайловые карты" },
  { id: "window_utils", en: "Window & utilities",  ru: "Окно и утилиты" },
  { id: "camera",       en: "Camera",              ru: "Камера" },
  { id: "transforms",   en: "Transformations",     ru: "Трансформации" },
  { id: "color",        en: "Color & shading",     ru: "Цвет и оттенки" },
  { id: "procedural",   en: "Procedural patterns", ru: "Процедурная генерация" },
  { id: "debugging",    en: "Debugging",           ru: "Отладка" },
];

export const RECIPES: DocRecipe[] = [
  // ─── Drawing basics ──────────────────────────────────────────────────────
  {
    id: "set_canvas_size",
    section: "drawing",
    difficulty: "beginner",
    en: { title: "Set the canvas size", intro: "Choose how big your game window is." },
    ru: { title: "Задать размер холста", intro: "Выбери размер игрового окна." },
    entryIds: ["size", "width", "height"],
  },
  {
    id: "draw_a_shape",
    section: "drawing",
    difficulty: "beginner",
    en: { title: "Draw a shape", intro: "Circles, rectangles, ellipses, lines, and points." },
    ru: { title: "Нарисовать фигуру", intro: "Круги, прямоугольники, эллипсы, линии и точки." },
    entryIds: ["background", "circle", "rect", "ellipse", "line", "point"],
  },
  {
    id: "pick_colors",
    section: "drawing",
    difficulty: "beginner",
    en: { title: "Pick colors", intro: "Set fill and stroke colors for shapes." },
    ru: { title: "Выбрать цвета", intro: "Задай цвет заливки и обводки для фигур." },
    entryIds: ["colors_palette", "fill_color", "no_fill", "stroke_color", "no_stroke", "stroke_width"],
  },
  {
    id: "write_text",
    section: "drawing",
    difficulty: "intermediate",
    en: { title: "Write text", intro: "Show words and numbers on screen." },
    ru: { title: "Написать текст", intro: "Покажи слова и числа на экране." },
    entryIds: ["text", "say", "text_size", "text_align"],
  },
  {
    id: "show_an_image",
    section: "drawing",
    difficulty: "intermediate",
    en: { title: "Show an image", intro: "Draw a sprite you uploaded as an asset." },
    ru: { title: "Показать изображение", intro: "Нарисуй спрайт, который ты загрузил." },
    entryIds: ["assets_sprites", "image"],
  },

  // ─── Actors ──────────────────────────────────────────────────────────────
  {
    id: "make_an_actor",
    section: "actors",
    difficulty: "beginner",
    en: { title: "Make an actor", intro: "Create a game object with position, size, and behavior." },
    ru: { title: "Создать актёра", intro: "Создай игровой объект с позицией, размером и поведением." },
    entryIds: ["actor_class", "actor_methods"],
  },
  {
    id: "builtin_actor_shapes",
    section: "actors",
    difficulty: "beginner",
    en: { title: "Use built-in actor shapes", intro: "Quick rectangles and circles that behave like actors." },
    ru: { title: "Готовые фигуры-актёры", intro: "Быстрые прямоугольники и круги, которые работают как актёры." },
    entryIds: ["rect_actor", "circle_actor"],
  },
  {
    id: "detect_one_collision",
    section: "actors",
    difficulty: "beginner",
    en: { title: "Detect one collision", intro: "Check if two actors touch each other — the first step to making things react." },
    ru: { title: "Обнаружить одно столкновение", intro: "Проверь, касаются ли два актёра — первый шаг к взаимодействию." },
    entryIds: ["actor_collider"],
  },
  {
    id: "detect_collisions",
    section: "actors",
    difficulty: "intermediate",
    en: { title: "Check collisions against a whole group", intro: "Test one actor against many at once, and bounce off what it hits." },
    ru: { title: "Столкновения с целой группой", intro: "Проверь одного актёра против многих сразу и отскочи от того, во что он попал." },
    entryIds: ["actor_collider", "group", "bounce_of"],
  },
  {
    id: "actor_anchors",
    section: "actors",
    difficulty: "intermediate",
    en: { title: "Place actors precisely (anchors)", intro: "Control what point of an actor lines up with its position." },
    ru: { title: "Точное размещение актёров (якоря)", intro: "Управляй тем, какая точка актёра совпадает с позицией." },
    entryIds: ["actor_anchors"],
  },
  {
    id: "spatial_helpers",
    section: "actors",
    difficulty: "intermediate",
    en: { title: "Find nearby actors", intro: "Distance and direction between actors." },
    ru: { title: "Найти ближайших актёров", intro: "Расстояние и направление между актёрами." },
    entryIds: ["actor_spatial"],
  },
  {
    id: "groups",
    section: "actors",
    difficulty: "intermediate",
    en: { title: "Manage many actors (Group)", intro: "Handle a whole collection of actors at once." },
    ru: { title: "Управлять группой актёров", intro: "Работай с целой коллекцией актёров сразу." },
    entryIds: ["group", "actor_static"],
  },

  // ─── Animation ───────────────────────────────────────────────────────────
  {
    id: "animate_a_sprite",
    section: "animation",
    difficulty: "beginner",
    en: { title: "Animate a sprite", intro: "Play a sequence of frames as a moving sprite." },
    ru: { title: "Анимировать спрайт", intro: "Воспроизведи последовательность кадров как движущийся спрайт." },
    entryIds: ["assets_animations", "animation_class", "animation_update", "animation_play", "animation_loop", "animation_done"],
  },
  {
    id: "load_sprites",
    section: "animation",
    difficulty: "intermediate",
    en: { title: "Load sprites", intro: "Access sprites you uploaded as assets." },
    ru: { title: "Загрузить спрайты", intro: "Обратись к загруженным спрайтам." },
    entryIds: ["assets_sprites"],
  },
  {
    id: "show_one_frame",
    section: "animation",
    difficulty: "intermediate",
    en: { title: "Show one frame", intro: "Get the current frame image to pass to image()." },
    ru: { title: "Показать один кадр", intro: "Получи текущий кадр для передачи в image()." },
    entryIds: ["animation_frame"],
  },
  {
    id: "use_a_timer",
    section: "animation",
    difficulty: "intermediate",
    en: { title: "Time and timers", intro: "Trigger something after a delay or measure how long since." },
    ru: { title: "Время и таймеры", intro: "Запусти что-то по задержке или измерь, сколько прошло." },
    entryIds: ["timer", "timer_left", "timer_elapsed", "timer_done", "timer_restart"],
  },
  {
    id: "sheet_sprite_actor",
    section: "animation",
    difficulty: "intermediate",
    en: { title: "Animate an actor from a sprite sheet", intro: "Build a walking/running character out of a sheet's named animations, switching between them based on input." },
    ru: { title: "Анимировать актёра из листа спрайтов", intro: "Собери ходящего/бегущего персонажа из именованных анимаций листа, переключая их по вводу." },
    entryIds: ["assets_sheet_namespace", "sprite_entry", "sheet_animation", "animation_controller_tick", "actor_with_sheet"],
  },

  // ─── Movement & input ────────────────────────────────────────────────────
  {
    id: "move_one_actor",
    section: "input",
    difficulty: "beginner",
    en: { title: "Move one actor", intro: "Read arrow keys each frame and move a shape on screen." },
    ru: { title: "Двигать одного актёра", intro: "Читай стрелки в каждом кадре и двигай фигуру на экране." },
    entryIds: ["keyboard", "keyboard_keys"],
  },
  {
    id: "run_game_loop",
    section: "input",
    difficulty: "beginner",
    en: { title: "Run the game loop", intro: "Call your frame function ~60 times per second." },
    ru: { title: "Запустить игровой цикл", intro: "Вызывай функцию кадра ~60 раз в секунду." },
    entryIds: ["run", "stop", "frame_rate", "frame_count"],
  },
  {
    id: "follow_with_mouse",
    section: "input",
    difficulty: "intermediate",
    en: { title: "Follow with the mouse", intro: "Read the mouse position and clicks." },
    ru: { title: "Следовать за мышью", intro: "Читай позицию мыши и клики." },
    entryIds: ["mouse"],
  },
  {
    id: "move_with_keys",
    section: "input",
    difficulty: "intermediate",
    en: { title: "Move diagonally at consistent speed", intro: "Combine two arrow-key axes into one velocity vector so diagonal movement isn't faster than straight movement." },
    ru: { title: "Диагональное движение с постоянной скоростью", intro: "Объедини две оси стрелок в один вектор скорости, чтобы диагональ не была быстрее прямого движения." },
    entryIds: ["keyboard", "keyboard_keys", "vector2"],
  },
  {
    id: "vector_math",
    section: "input",
    difficulty: "advanced",
    en: { title: "Do math with points", intro: "Add, scale, and rotate positions and velocities." },
    ru: { title: "Математика точек", intro: "Складывай, масштабируй и поворачивай позиции и скорости." },
    entryIds: ["vector2", "polar"],
  },

  // ─── Sound ───────────────────────────────────────────────────────────────
  {
    id: "play_sound_on_event",
    section: "sound",
    difficulty: "beginner",
    en: { title: "Play a sound on an event", intro: "Trigger a sound effect the moment something happens — a bounce, a catch, a hit." },
    ru: { title: "Воспроизвести звук по событию", intro: "Запусти звуковой эффект в нужный момент — прыжок, поимка, удар." },
    entryIds: ["sounds", "sound_play"],
  },
  {
    id: "play_a_sound",
    section: "sound",
    difficulty: "intermediate",
    en: { title: "Play a sound", intro: "Play, loop, pause, and stop sound assets." },
    ru: { title: "Воспроизвести звук", intro: "Запусти, зацикли, поставь на паузу и останови звук." },
    entryIds: ["sounds", "sound_play", "sound_loop", "sound_pause", "sound_stop"],
  },

  // ─── Tilemaps ────────────────────────────────────────────────────────────
  {
    id: "build_a_tilemap",
    section: "tilemaps",
    difficulty: "intermediate",
    en: { title: "Build a tilemap", intro: "Draw a level out of tiles arranged in a grid." },
    ru: { title: "Собрать тайловую карту", intro: "Нарисуй уровень из тайлов, расставленных по сетке." },
    entryIds: ["assets_tilemaps", "tilemap_class", "tilemap_layer_class"],
  },
  {
    id: "tilemap_areas",
    section: "tilemaps",
    difficulty: "intermediate",
    en: { title: "Detect tilemap collisions", intro: "Brush named zones (ground, walls, hazards) onto the tilemap in the editor, then check collisions in code with a single method call." },
    ru: { title: "Обнаружить столкновения с тайловой картой", intro: "Нарисуй именованные зоны (земля, стены, опасности) в редакторе тайловой карты и проверяй столкновения в коде одним вызовом метода." },
    entryIds: ["tilemap_areas", "tilemap_collides_with", "tilemap_collides_with_any"],
  },

  // ─── Window & utilities ──────────────────────────────────────────────────
  {
    id: "window_anchors",
    section: "window_utils",
    difficulty: "intermediate",
    en: { title: "Anchor things to window edges", intro: "Position UI relative to the window corners and edges." },
    ru: { title: "Привязать к краям окна", intro: "Размести UI относительно углов и краёв окна." },
    entryIds: ["window_singleton", "window_anchors", "anchor_point"],
  },
  {
    id: "get_random",
    section: "window_utils",
    difficulty: "intermediate",
    en: { title: "Get random values", intro: "Pick a random integer or color." },
    ru: { title: "Получить случайное значение", intro: "Выбери случайное целое число или цвет." },
    entryIds: ["randint_fn", "random_color"],
  },

  // ─── Camera ──────────────────────────────────────────────────────────────
  {
    id: "camera_follow",
    section: "camera",
    difficulty: "intermediate",
    en: { title: "Moving camera", intro: "Scroll the view to keep the player visible." },
    ru: { title: "Подвижная камера", intro: "Сдвигай вид, чтобы игрок оставался виден." },
    entryIds: ["camera"],
  },

  // ─── Transformations ─────────────────────────────────────────────────────
  {
    id: "move_rotate_scale",
    section: "transforms",
    difficulty: "intermediate",
    en: { title: "Move, rotate, scale", intro: "Shift, turn, and resize the coordinate system." },
    ru: { title: "Сдвиг, поворот, масштаб", intro: "Сдвигай, вращай и масштабируй систему координат." },
    entryIds: ["push", "pop", "translate", "rotate", "scale", "translated", "rotated", "scaled", "stamp"],
  },

  // ─── Color & shading ─────────────────────────────────────────────────────
  {
    id: "color_math_basics",
    section: "color",
    difficulty: "beginner",
    en: { title: "Color math basics", intro: "Mix colors with lerp, and nudge a color darker or lighter — the same tools the editor's brushes use." },
    ru: { title: "Основы цветовой математики", intro: "Смешивай цвета через lerp и делай цвет темнее или светлее — те же инструменты, что у кистей редактора." },
    entryIds: ["lerp", "darker", "lighter"],
  },
  {
    id: "mix_colors",
    section: "color",
    difficulty: "intermediate",
    en: { title: "Mix two colors", intro: "Blend smoothly between two colors using lerp." },
    ru: { title: "Смешать два цвета", intro: "Плавно перейди от одного цвета к другому через lerp." },
    entryIds: ["lerp"],
  },
  {
    id: "shade_a_color",
    section: "color",
    difficulty: "intermediate",
    en: { title: "Make it darker, lighter, more vivid", intro: "Step a color up and down the shade and saturation scales — the same step the editor's brushes use." },
    ru: { title: "Темнее, светлее, насыщеннее", intro: "Сдвинь цвет по шкалам яркости и насыщенности — тот же шаг, что у кистей редактора." },
    entryIds: ["darker", "lighter", "saturated", "desaturated"],
  },
  {
    id: "paint_a_sprite",
    section: "color",
    difficulty: "advanced",
    en: { title: "Paint a sprite in code", intro: "Make a new sprite, draw pixels into it, then recolor or bucket-fill it." },
    ru: { title: "Нарисовать спрайт кодом", intro: "Создай спрайт, рисуй в нём пиксели, потом перекрашивай или заливай ведром." },
    entryIds: ["create_sprite", "sprite_from_ascii", "set_pixel", "get_pixel", "sprite_get_set", "flood_fill", "palette_swap", "darken", "lighten", "sprite_context_manager"],
  },

  // ─── Procedural patterns ─────────────────────────────────────────────────
  {
    id: "random_vs_noise",
    section: "procedural",
    difficulty: "beginner",
    en: { title: "Random numbers vs noise", intro: "randint() gives jitter; noise(x, y) gives smooth, repeatable patterns. See the difference in 30 seconds." },
    ru: { title: "Случайные числа vs шум", intro: "randint() даёт хаос; noise(x, y) — плавные, повторяемые паттерны. Увидь разницу за 30 секунд." },
    entryIds: ["randint_fn", "noise"],
  },
  {
    id: "noise_patterns",
    section: "procedural",
    difficulty: "intermediate",
    en: { title: "Smooth noise for natural shapes", intro: "Use deterministic noise to seed terrain, caves, or dithered colors." },
    ru: { title: "Гладкий шум для природных форм", intro: "Детерминированный шум для рельефа, пещер или дитеринга цветов." },
    entryIds: ["noise"],
  },
  {
    id: "scatter_randomly",
    section: "procedural",
    difficulty: "advanced",
    en: { title: "Scatter things randomly", intro: "Pick random integers and colors; scatter tiles across a TileGroup." },
    ru: { title: "Случайное размещение", intro: "Получай случайные целые числа и цвета; разбрасывай тайлы по TileGroup." },
    entryIds: ["randint_fn", "random_color", "tile_group", "tilemap_group"],
  },

  // ─── Debugging ───────────────────────────────────────────────────────────
  {
    id: "print_and_pin_values",
    section: "debugging",
    difficulty: "beginner",
    en: { title: "Print and pin live values", intro: "peek() for a one-off dump, watch() to keep a value pinned above the console while your program runs." },
    ru: { title: "Печать и закрепление значений", intro: "peek() для разового вывода, watch() — чтобы закрепить значение над консолью, пока программа работает." },
    entryIds: ["peek", "watch"],
  },
  {
    id: "visualize_an_algorithm",
    section: "debugging",
    difficulty: "advanced",
    en: { title: "Visualize an algorithm step by step", intro: "Register an array, grid, stack, queue, or set with pi3.debug, call debug.show() each step, then scrub through the recorded frames." },
    ru: { title: "Визуализировать алгоритм по шагам", intro: "Зарегистрируй массив, сетку, стек, очередь или множество через pi3.debug, вызывай debug.show() на каждом шаге и пролистывай записанные кадры." },
    entryIds: ["debug_array", "debug_grid", "debug_stack", "debug_queue", "debug_members", "debug_show"],
  },
];
