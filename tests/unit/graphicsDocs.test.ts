/**
 * Regression guard for the in-IDE API reference panel.
 *
 * Per CLAUDE.md, `src/docs/graphicsDocs.ts` is the single source of truth for
 * the API reference. These assertions pin the doc entries that were added
 * alongside the graphics-lighting-collisions-themes change so a future
 * refactor that drops them turns CI red.
 */

import { DOCS } from '../../src/docs/graphicsDocs';

describe('graphicsDocs — new API entries from graphics-lighting-collisions-themes', () => {
  it('has a Themes & Lighting category with Themes / Light / Light methods entries', () => {
    const cat = DOCS.find((c) => c.id === 'themes_lighting');
    expect(cat).toBeDefined();
    expect(cat!.entries.map((e) => e.id)).toEqual([
      'themes_namespace',
      'light_class',
      'light_methods',
    ]);
  });

  it('documents every Light method including style and the "draw last" rule', () => {
    const cat = DOCS.find((c) => c.id === 'themes_lighting')!;
    const lightMethods = cat.entries.find((e) => e.id === 'light_methods')!;
    const names = lightMethods.params!.map((p) => p.name);
    for (const m of [
      'add_source(actor_or_group_or_pos)',
      'add_obstacles(group)',
      'add_obst(actor)',
      'shade(name)',
      'flicker(enabled=True)',
      'radius(r)',
      'style(theme)',
      'draw()',
    ]) {
      expect(names).toContain(m);
    }
    const drawDoc = lightMethods.params!.find((p) => p.name === 'draw()')!;
    expect(drawDoc.en).toMatch(/LAST/);
  });

  it('documents Themes.current as a separate entry', () => {
    const themes = DOCS
      .find((c) => c.id === 'themes_lighting')!
      .entries.find((e) => e.id === 'themes_namespace')!;
    expect(themes.params!.map((p) => p.name)).toContain('Themes.current');
  });

  it('documents the tile-tag workflow as a dedicated entry', () => {
    const tilemap = DOCS.find((c) => c.id === 'tilemap')!;
    const tagsEntry = tilemap.entries.find((e) => e.id === 'tilemap_tags');
    expect(tagsEntry).toBeDefined();
    expect(tagsEntry!.signature).toMatch(/\.tag\(.*\)/);
    expect(tagsEntry!.signature).toMatch(/\.all_tiles\(/);
    // The body should cover both TileMap-level and TilemapLayer-level usage.
    const paramNames = tagsEntry!.params!.map((p) => p.name).join(' | ');
    expect(paramNames).toMatch(/level\.tag/);
    expect(paramNames).toMatch(/all_tiles/);
    expect(paramNames).toMatch(/layer\.tag/);
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

  it('cross-references Themes from the Colors entry', () => {
    const colors = DOCS
      .find((c) => c.id === 'color')!
      .entries.find((e) => e.id === 'colors_palette')!;
    expect(colors.en).toMatch(/Themes/);
  });
});
