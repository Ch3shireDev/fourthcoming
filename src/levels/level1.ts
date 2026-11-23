import type { LevelData } from '../world/parse';

/**
 * Level 1: "Nieskończony mur".
 * In w = 0 a wall crosses the whole board, edge to edge. In w = 1 it does not exist.
 * Trees in w = 1 show up as ghosts in w = 0, hinting that something lies "next door".
 */
export const level1: LevelData = {
  name: 'Nieskończony mur',
  subtitle: 'Jak przejść na drugą stronę muru, który nie ma końca?',
  slices: [
    // w = 0
    [
      '...#...',
      '...#...',
      '...#.S.',
      '.G.#...',
      '...#...',
      '...#...',
      '...#...',
    ],
    // w = 1
    [
      '......T',
      '.......',
      '.......',
      '.......',
      'T......',
      '.......',
      '....T..',
    ],
    // w = 2
    [
      '.......',
      '....T..',
      '...h...',
      'T..h...',
      '.......',
      '...h...',
      '......T',
    ],
  ],
};
