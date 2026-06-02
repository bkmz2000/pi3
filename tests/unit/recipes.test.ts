import { readFileSync } from 'fs';
import { resolve } from 'path';

import { RECIPES, RECIPE_SECTIONS } from '../../src/docs/recipes';

const DIFFICULTY_ORDER = { beginner: 0, intermediate: 1, advanced: 2 } as const;

// Maps bouncing_actor API identifiers → graphicsDocs entryIds they resolve to
const BOUNCING_ACTOR_API_MAP: Record<string, string> = {
  Colors: 'colors_palette',
  Circle: 'circle_actor',
  Keyboard: 'keyboard',
  background: 'background',
  size: 'size',
  run: 'run',
};

function beginnerEntryIds(): Set<string> {
  const ids = new Set<string>();
  for (const recipe of RECIPES) {
    if (recipe.difficulty === 'beginner') {
      for (const id of recipe.entryIds) {
        ids.add(id);
      }
    }
  }
  return ids;
}

describe('recipes — difficulty field', () => {
  it('every recipe has a difficulty field', () => {
    const missing = RECIPES.filter((r) => !r.difficulty);
    expect(missing.map((r) => r.id)).toEqual([]);
  });
});

describe('recipes — beginner coverage for required primitives', () => {
  const beginnerIds = beginnerEntryIds();

  it('animation primitive covered by a beginner recipe', () => {
    const has = RECIPES.some(
      (r) => r.difficulty === 'beginner' && r.section === 'animation',
    );
    expect(has).toBe(true);
  });

  it('input / keyboard primitive covered by a beginner recipe', () => {
    expect(beginnerIds.has('keyboard')).toBe(true);
  });

  it('collision primitive covered by a beginner recipe', () => {
    expect(beginnerIds.has('actor_collider')).toBe(true);
  });

  it('sound-on-event primitive covered by a beginner recipe', () => {
    expect(beginnerIds.has('sound_play')).toBe(true);
  });

  it('random_fn primitive covered by a beginner recipe', () => {
    expect(beginnerIds.has('random_fn')).toBe(true);
  });

  it('noise primitive covered by a beginner recipe', () => {
    expect(beginnerIds.has('noise')).toBe(true);
  });

  it('color lerp covered by a beginner recipe', () => {
    expect(beginnerIds.has('lerp')).toBe(true);
  });

  it('color darker/lighter covered by beginner recipe(s)', () => {
    expect(beginnerIds.has('darker') || beginnerIds.has('lighter')).toBe(true);
  });
});

describe('recipes — ordering within each section', () => {
  for (const section of RECIPE_SECTIONS) {
    const sectionRecipes = RECIPES.filter((r) => r.section === section.id);
    if (sectionRecipes.length < 2) continue;

    it(`${section.id}: beginner before intermediate before advanced`, () => {
      let lastOrder = -1;
      for (const recipe of sectionRecipes) {
        const order = DIFFICULTY_ORDER[recipe.difficulty];
        expect(order).toBeGreaterThanOrEqual(lastOrder);
        lastOrder = order;
      }
    });
  }
});

describe('recipes — bouncing_actor static API coverage', () => {
  const beginnerIds = beginnerEntryIds();
  const src = readFileSync(
    resolve(__dirname, '../../src/assets/examples/bouncing_actor/main.py'),
    'utf8',
  );

  for (const [apiName, entryId] of Object.entries(BOUNCING_ACTOR_API_MAP)) {
    it(`${apiName} (→ entryId "${entryId}") is covered by a beginner recipe`, () => {
      expect(src).toMatch(new RegExp(`\\b${apiName}\\b`));
      expect(beginnerIds.has(entryId)).toBe(true);
    });
  }
});
