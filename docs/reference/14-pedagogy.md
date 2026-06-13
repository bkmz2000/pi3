> **Archived — written 2026-04-30. Predates significant codebase changes (API-v1 rework, decomposition, save-flow overhaul, error system, pixel editor). Verify against current code before relying on any detail. [CLAUDE.md](../../CLAUDE.md) is authoritative for architecture notes.**

# Pedagogy — Concept Progression

This document describes the intended learning ladder so contributors can maintain the scaffolding without re-introducing gaps.

## The problem this solves

Built-in examples previously clustered at two altitudes: trivial one-liners (`hello_world`, `input`, `p5`) and full game-loops (`snake`, `sokoban`, `asteroids`). A student who finished `p5` had no guided next step — they faced state machines, noise functions, and sprite APIs with no prior recipe coverage.

## The ladder

```
Level 1 — Primitives (beginner recipes in Docs panel)
  Each recipe introduces exactly one API in isolation:
  Animate a sprite · Move one actor · Detect one collision
  Play a sound on event · Random vs noise · Color math basics

Level 2 — Combination (bouncing_actor example)
  Single example that combines only the Level 1 primitives:
  Circle actor + arrow-key movement + edge bounce + color cycle

Level 3 — Simple games (catch, snake, robot, p5)
  Complete loops with score, lives, game-over. Each introduces
  exactly one new pattern beyond Level 2.

Level 4 — Procedural (cave_generator, random_walls, color_shifter …)
  Combine noise, color math, tile groups — assume Levels 1-3.

Level 5 — Complex games (sokoban, asteroids, dungeon, platformer)
  Assume full API fluency.
```

## Rules for contributors

1. **Recipes own primitives; examples own combinations.** Never introduce an API call in an example before there is a beginner-tagged recipe that covers it in isolation.

2. **Recipe difficulty ordering is enforced by test.** `tests/unit/recipes.test.ts` asserts that within each section all `beginner` recipes precede `intermediate` which precede `advanced`. The test fails if you add a recipe with the wrong order.

3. **Static API check for `bouncing_actor`.** The same test file statically verifies that every graphics identifier used in `bouncing_actor/main.py` is covered by a beginner recipe. Update `BOUNCING_ACTOR_API_MAP` in the test if the example gains new API calls.

4. **`sprite_painter` is tagged advanced.** It uses `set_pixel`/`flood_fill`/`palette_swap` which have no beginner recipe yet. If you add beginner sprite-pixel recipes, re-tag it.

## Difficulty tagging

Every `DocRecipe` in `src/docs/recipes.ts` has a `difficulty: 'beginner' | 'intermediate' | 'advanced'` field. When in doubt, use `intermediate`. Use `beginner` only when the recipe introduces a single primitive that appears in Level 1 or 2 examples.
