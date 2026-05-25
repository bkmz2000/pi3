/**
 * Regression guard for the in-IDE API reference panel.
 *
 * Per CLAUDE.md, `src/docs/graphicsDocs.ts` is the single source of truth for
 * the API reference. These assertions pin the doc entries that were added
 * alongside the graphics-lighting-collisions-themes change so a future
 * refactor that drops them turns CI red.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

import { DOCS } from '../../src/docs/graphicsDocs';

describe('graphicsDocs — tilemap + actor regression guards', () => {
  it('Lighting category is hidden from docs (Python class stays callable)', () => {
    expect(DOCS.find((c) => c.id === 'lighting')).toBeUndefined();
  });

  it('documents the tilemap Areas workflow as a dedicated entry', () => {
    const tilemap = DOCS.find((c) => c.id === 'tilemap')!;
    const areasEntry = tilemap.entries.find((e) => e.id === 'tilemap_areas');
    expect(areasEntry).toBeDefined();
    // Signature exposes the attribute-access shape.
    expect(areasEntry!.signature).toMatch(/tilemap\.areas\.<name>/);
    expect(areasEntry!.signature).toMatch(/Group/);

    // The runnable example should use the two canonical patterns: a floor
    // collision check and an area-as-zone test.
    expect(areasEntry!.example).toBeDefined();
    expect(areasEntry!.example!).toMatch(/level\.areas\./);
    expect(areasEntry!.example!).toMatch(/collides_any/);

    // Advanced note should call out the auto-merging (perf) and the
    // snake_case validation (since attribute access depends on it).
    expect(areasEntry!.advanced).toBeDefined();
    expect(areasEntry!.advanced!.en).toMatch(/merge/i);
    expect(areasEntry!.advanced!.en).toMatch(/snake_case|\[a-z\]/);

    // Legacy tag/all_tiles entry must not exist any more.
    expect(tilemap.entries.find((e) => e.id === 'tilemap_tags')).toBeUndefined();
  });

  it('documents Actor.future_state with the wall-stop example', () => {
    const actorMethods = DOCS
      .find((c) => c.id === 'actors')!
      .entries.find((e) => e.id === 'actor_methods')!;
    const fs = actorMethods.params!.find((p) => p.name === 'future_state');
    expect(fs).toBeDefined();
    expect(fs!.en).toMatch(/wall|collid/i);
  });

  it('documents Polar in the Math category', () => {
    const math = DOCS.find((c) => c.id === 'math')!;
    const polar = math.entries.find((e) => e.id === 'polar');
    expect(polar).toBeDefined();
    expect(polar!.signature).toMatch(/Polar\(magnitude,\s*angle_degrees\)/);
    expect(polar!.returns?.type).toBe('Vector2');
    // Should mention the actor.vel use case
    expect(polar!.en).toMatch(/actor\.vel/);
  });

  it('flags actor.angle as visual-only and points to Polar for motion', () => {
    const actorClass = DOCS
      .find((c) => c.id === 'actors')!
      .entries.find((e) => e.id === 'actor_class')!;
    const angle = actorClass.params!.find((p) => p.name === 'angle')!;
    expect(angle.en).toMatch(/visual/i);
    expect(angle.en).toMatch(/Polar/);
  });

  it('color math primitives are documented and exist in the Python module', () => {
    const color = DOCS.find((c) => c.id === 'color')!;
    const ids = ['lerp', 'darker', 'lighter', 'saturated', 'desaturated'];
    for (const id of ids) {
      const entry = color.entries.find((e) => e.id === id);
      expect(entry).toBeDefined();
      expect(entry!.example).toBeTruthy();
      expect(entry!.returns).toBeDefined();
    }

    // lerp is the foundational primitive — its description must call out the
    // transfer to non-color uses, per the Stage 0 pedagogy.
    const lerp = color.entries.find((e) => e.id === 'lerp')!;
    expect(lerp.en).toMatch(/number/i);
    expect(lerp.signature).toMatch(/lerp\(a,\s*b,\s*t\)/);

    // The Python module must actually define these — drift between docs and
    // runtime is the bug this guard exists to catch.
    const py = readFileSync(
      resolve(__dirname, '../../src/assets/python/graphics/__init__.py'),
      'utf8',
    );
    for (const id of ids) {
      expect(py).toMatch(new RegExp(`^def ${id}\\(`, 'm'));
    }
    expect(py).toMatch(/^\s*"lerp",\s*"darker",\s*"lighter",\s*"saturated",\s*"desaturated",/m);
  });

  it('Sprite data API is documented and exists in the Python module', () => {
    const sprite = DOCS.find((c) => c.id === 'sprite');
    expect(sprite).toBeDefined();
    const ids = [
      'sheet',
      'create_sprite',
      'get_pixel',
      'set_pixel',
      'palette_swap',
      'flood_fill',
      'darken',
      'lighten',
      'saturate',
      'desaturate',
    ];
    for (const id of ids) {
      const entry = sprite!.entries.find((e) => e.id === id);
      expect(entry).toBeDefined();
      expect(entry!.example).toBeTruthy();
    }
    // The transparency convention (returns None) is load-bearing — guard it.
    const getPixel = sprite!.entries.find((e) => e.id === 'get_pixel')!;
    expect(getPixel.en).toMatch(/None/);

    const py = readFileSync(
      resolve(__dirname, '../../src/assets/python/graphics/__init__.py'),
      'utf8',
    );
    expect(py).toMatch(/^class Sprite:/m);
    // `sheet` is a module-level dict the worker populates at run start, not
    // a function — assert it separately.
    expect(py).toMatch(/^sheet = \{\}/m);
    for (const id of ids) {
      if (id === 'sheet') continue;
      expect(py).toMatch(new RegExp(`^def ${id}\\(`, 'm'));
    }

    // Worker must wire editor assets into graphics.sheet — if this regresses,
    // sheet["name"] silently returns nothing and kids see KeyError with no
    // hint why.
    const worker = readFileSync(
      resolve(__dirname, '../../src/runner/worker.ts'),
      'utf8',
    );
    expect(worker).toMatch(/_asset_pixels/);
    expect(worker).toMatch(/graphics\.sheet\s*=/);
  });

  it('Colors entry exposes the Sweetie 16 swatches', () => {
    const colors = DOCS
      .find((c) => c.id === 'color')!
      .entries.find((e) => e.id === 'colors_palette')!;
    expect(colors.swatches).toBeDefined();
    expect(colors.swatches!.length).toBe(16);
    const names = colors.swatches!.map((s) => s.name);
    expect(names).toContain('black');
    expect(names).toContain('wine');
    expect(names).toContain('slate');
    expect(names).not.toContain('pink');
    expect(names).not.toContain('purple');
    expect(names).not.toContain('brown');
  });
});
