// Curated example catalog — single source of truth for both the marketing
// gallery (src/pages/ExamplesGalleryPage.tsx) and the in-editor Examples
// panel (src/ExamplesPanel.tsx), so the two surfaces never drift.

export interface CatalogEntry {
  key: string;
  i18nKey: string;
}

export interface CatalogTopic {
  i18nKey: string;
  entries: CatalogEntry[];
}

// Curated inclusion list — the "Example set v1" roster (7 topics) plus the
// two newer sprite-sheet demos. Deliberately excludes 8 pre-v1 relics still
// present in exampleProjects.ts (swatches, p5, platformer, color_shifter,
// gradient_sky, sprite_painter, random_walls, cave_generator): showcase
// demos, not complete games, not ready for an audience with zero context.
// Display text lives in en.json/ru.json under examplesGallery.topics/entries.
export const EXAMPLES_CATALOG: CatalogTopic[] = [
  {
    i18nKey: 'basics',
    entries: [
      { key: 'hello world', i18nKey: 'helloWorld' },
      { key: 'input', i18nKey: 'input' },
    ],
  },
  {
    i18nKey: 'color',
    entries: [
      { key: 'color flood', i18nKey: 'colorFlood' },
      { key: 'chameleon', i18nKey: 'chameleon' },
    ],
  },
  {
    i18nKey: 'input',
    entries: [
      { key: 'robot', i18nKey: 'robot' },
      { key: 'aim trainer', i18nKey: 'aimTrainer' },
    ],
  },
  {
    i18nKey: 'actors',
    entries: [
      { key: 'bouncing actor', i18nKey: 'bouncingActor' },
      { key: 'catch', i18nKey: 'catch' },
      { key: 'dungeon', i18nKey: 'dungeon' },
    ],
  },
  {
    i18nKey: 'classicGames',
    entries: [
      { key: 'snake', i18nKey: 'snake' },
      { key: 'sokoban', i18nKey: 'sokoban' },
      { key: 'asteroids', i18nKey: 'asteroids' },
    ],
  },
  {
    i18nKey: 'procgen',
    entries: [
      { key: 'maze runner', i18nKey: 'mazeRunner' },
      { key: 'cave diver', i18nKey: 'caveDiver' },
    ],
  },
  {
    i18nKey: 'tilemaps',
    entries: [
      { key: 'top-down explorer', i18nKey: 'topDownExplorer' },
      { key: 'room builder', i18nKey: 'roomBuilder' },
    ],
  },
  {
    i18nKey: 'spriteSheets',
    entries: [
      { key: 'slime runner', i18nKey: 'slimeRunner' },
      { key: 'coin hop', i18nKey: 'coinHop' },
    ],
  },
];
