export type DocConcept = {
  id: string;
  en: { title: string; body: string };
  ru: { title: string; body: string };
  example?: string;
};

export const CONCEPTS: DocConcept[] = [
  {
    id: "assets",
    en: {
      title: "Using assets",
      body:
        "An asset is a piece of content you load into your project from the Assets panel — a sprite, an animation, a tilemap, or a sound. Once uploaded, you access it from code through the global `assets` namespace by the name you gave it.",
    },
    ru: {
      title: "Использование ресурсов",
      body:
        "Ресурс — это то, что ты загружаешь в проект через панель «Ресурсы»: спрайт, анимация, тайловая карта или звук. После загрузки ресурс доступен из кода через глобальное пространство имён `assets` по названию, которое ты выбрал.",
    },
    example:
      "# After uploading a sprite named \"hero\":\nimage(assets.sprites.hero, 100, 100)\n\n# After uploading a sound named \"jump\":\nassets.sounds.jump.play()",
  },
  {
    id: "coords",
    en: {
      title: "Coordinates & anchors",
      body:
        "The canvas uses pixel coordinates. By default (0, 0) is the top-left corner; x grows to the right, y grows downward. Most things you draw have an anchor — the point on the shape that lines up with the (x, y) you give. For shapes it's usually the center; for images it's the top-left unless you change it.",
    },
    ru: {
      title: "Координаты и якоря",
      body:
        "Холст использует пиксельные координаты. По умолчанию (0, 0) — это верхний левый угол; x растёт вправо, y растёт вниз. У большинства объектов есть «якорь» — точка фигуры, которая совмещается с переданными координатами (x, y). У фигур это обычно центр; у изображений — верхний левый угол.",
    },
    example: "circle(100, 100, 30)   # center at (100, 100)\nimage(spr, 100, 100)   # top-left corner at (100, 100)",
  },
  {
    id: "game_loop",
    en: {
      title: "The game loop",
      body:
        "A game is a loop: many times per second the program clears the screen, updates the state (positions, timers, input), and draws a new frame. Pass `run()` a function you want to call ~60 times a second. It's common to name this function `main` and have it call smaller functions in order — one for drawing, one for input, one for physics, and so on. Variables you want to keep between frames go in a `State(**kwargs)` object instead of bare module variables — that way every function can read and write them without a `global` statement.",
    },
    ru: {
      title: "Игровой цикл",
      body:
        "Игра — это цикл: много раз в секунду программа очищает экран, обновляет состояние (позиции, таймеры, ввод) и рисует новый кадр. Передай в `run()` функцию, которую хочешь выполнять примерно 60 раз в секунду. Обычно эту функцию называют `main`, а из неё в нужном порядке вызывают другие функции, каждая из которых отвечает за свою область: рисование, управление, физика и т.д. Переменные, которые нужно сохранять между кадрами, удобнее держать в объекте `State(**kwargs)`, а не в обычных переменных модуля — тогда любая функция может их читать и менять без `global`.",
    },
    example:
      "state = State(x=0)\n\ndef frame():\n    state.x += 1\n    background(\"black\")\n    circle(state.x, 100, 20)\n\nrun(frame)",
  },
  {
    id: "vectors",
    en: {
      title: "Vectors and speed",
      body:
        "A position is two numbers (x, y). A velocity is also two numbers — how much x and y change each frame. To move something, add its velocity to its position every frame. `Vector2` packages both into one value so you can add, scale, or rotate them in one step.",
    },
    ru: {
      title: "Векторы и скорость",
      body:
        "Позиция — это два числа (x, y). Скорость — тоже два числа: насколько x и y меняются за кадр. Чтобы двигать объект, прибавляй его скорость к позиции каждый кадр. `Vector2` объединяет оба числа в одно значение, чтобы складывать, масштабировать или поворачивать их одним действием.",
    },
    example:
      "pos = Vector2(50, 50)\nvel = Vector2(2, 1)\n\ndef frame():\n    pos.x += vel.x\n    pos.y += vel.y\n    background(\"black\")\n    circle(pos.x, pos.y, 10)\n\nrun(frame)",
  },
  {
    id: "animation_concepts",
    en: {
      title: "Animation concepts",
      body:
        "An animation is a list of frames. Playing it means advancing through the frames over time. Frame rate (frames per second) controls speed. A looping animation goes back to the start when it ends; a non-looping one stops on the last frame. You drive an animation by calling `.update()` each frame.",
    },
    ru: {
      title: "Как устроена анимация",
      body:
        "Анимация — это последовательность кадров. Воспроизведение — это переход между кадрами по времени. Частота кадров (fps) задаёт скорость. Циклическая анимация возвращается к началу; нециклическая останавливается на последнем кадре. Чтобы анимация шла, вызывай `.update()` в каждом кадре.",
    },
    example:
      "anim = Animation(assets.animations.walk.frames, fps=12)\nanim.loop = True\n\ndef frame():\n    anim.update()\n    background(\"black\")\n    image(anim.frame, 100, 100)\n\nrun(frame)",
  },
  {
    id: "collisions",
    en: {
      title: "Collision detection",
      body:
        "A collision is two shapes overlapping. The simplest check is bounding-box overlap (do two rectangles touch?). Actors get this for free via a `Collider`. Detection only tells you a collision happened — to stop the actor, you also need to *resolve* it (push it back out).",
    },
    ru: {
      title: "Проверка столкновений",
      body:
        "Столкновение — это перекрытие двух фигур. Самая простая проверка — касаются ли два хитбокса (прямоугольники вокруг фигур). У актёров это уже встроено через `Collider`. Обнаружение только сообщает, что столкновение произошло — чтобы актёр не прошёл сквозь препятствие, столкновение нужно ещё и «разрешить» (вытолкнуть наружу).",
    },
    example:
      "if hero.collides_with(wall):\n    hero.set_pos(previous_pos)   # simple resolution: undo the move",
  },
  {
    id: "transforms",
    en: {
      title: "Transforms & the matrix stack",
      body:
        "`translate`, `rotate`, and `scale` change the coordinate system for everything drawn after them. They stack: `push()` saves the current transform, `pop()` restores it. The order matters — `translate` then `rotate` rotates around the moved origin, not the canvas origin. Use push/pop around any local transform to keep it from leaking into other drawings — or use `with translated(...):` / `with rotated(...):` / `with scaled(...):`, which wrap push/pop for you so a missing `pop()` can't happen. `Stamp` builds on the same idea: record a drawing once inside `with Stamp() as icon:`, then replay it anywhere with `icon.draw(x, y, angle)`.",
    },
    ru: {
      title: "Трансформации и стек матриц",
      body:
        "`translate`, `rotate` и `scale` меняют систему координат для всего, что рисуется после них. Они складываются стеком: `push()` сохраняет текущую трансформацию, `pop()` восстанавливает её. Порядок важен — `translate` потом `rotate` поворачивает вокруг новой точки отсчёта, а не вокруг (0, 0) холста. Оборачивай локальную трансформацию в push/pop, чтобы она не повлияла на остальные рисунки — либо используй `with translated(...):` / `with rotated(...):` / `with scaled(...):`, которые сами оборачивают push/pop, так что забыть `pop()` невозможно. `Stamp` работает по той же идее: запиши рисунок один раз внутри `with Stamp() as icon:`, а затем воспроизводи его где угодно через `icon.draw(x, y, angle)`.",
    },
    example:
      "with translated(100, 100):\n    with rotated(angle):\n        rect(-20, -20, 40, 40)   # rotates around (100, 100)",
  },
];
