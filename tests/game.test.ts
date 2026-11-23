import { describe, expect, it } from 'vitest';
import { Game, axisOf } from '../src/game/game';
import { parseLevel } from '../src/world/parse';
import { Cell } from '../src/world/world';
import { level1 } from '../src/levels/level1';

const newGame = () => new Game(parseLevel(level1));

describe('level parsing', () => {
  it('reads size, start and cells', () => {
    const lvl = parseLevel(level1);
    expect(lvl.world.size).toEqual([7, 7, 3]);
    expect(lvl.start).toEqual([5, 2, 0]);
    expect(lvl.world.get([3, 0, 0])).toBe(Cell.Wall);
    expect(lvl.world.get([3, 0, 1])).toBe(Cell.Floor);
    expect(lvl.world.get([1, 3, 0])).toBe(Cell.Goal);
    expect(lvl.world.get([-1, 0, 0])).toBe(Cell.Void);
  });
});

describe('movement', () => {
  it('is blocked by the wall in w = 0', () => {
    const g = newGame();
    expect(g.move(-1, 0)).toBe(true); // x 5 -> 4
    expect(g.move(-1, 0)).toBe(false); // wall at x = 3
    expect(g.pos).toEqual([4, 2, 0]);
  });

  it('cannot walk off the board into the void', () => {
    const g = newGame();
    g.move(1, 0);
    expect(g.move(1, 0)).toBe(false);
    expect(g.pos).toEqual([6, 2, 0]);
  });

  it('cannot reach the goal without the fourth dimension', () => {
    // flood fill inside w = 0 using only x/z moves
    const lvl = parseLevel(level1);
    const seen = new Set<string>();
    const stack = [lvl.start];
    while (stack.length) {
      const p = stack.pop()!;
      const k = p.join();
      if (seen.has(k)) continue;
      seen.add(k);
      expect(lvl.world.get(p)).not.toBe(Cell.Goal);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const q: [number, number, number] = [p[0] + dx, p[1] + dz, p[2]];
        const c = lvl.world.get(q);
        if (c === Cell.Floor || c === Cell.Goal) stack.push(q);
      }
    }
  });
});

describe('dimension swap', () => {
  it('swaps a visible axis with the hidden one and back', () => {
    const g = newGame();
    g.swap('u');
    expect(axisOf(g.basis.u)).toBe(2);
    expect(axisOf(g.basis.h)).toBe(0);
    expect(g.hiddenValue()).toBe(5); // frozen x
    g.swap('u');
    expect(axisOf(g.basis.u)).toBe(0);
    expect(axisOf(g.basis.h)).toBe(2);
  });

  it('two swaps of the same slot return to the start basis', () => {
    const g = newGame();
    g.swap('v');
    g.swap('v');
    expect(g.basis).toEqual(Game.initialBasis());
  });

  it('visible slots always show a positive axis', () => {
    const g = newGame();
    for (const s of ['u', 'v', 'u', 'u', 'v', 'v', 'u'] as const) {
      g.swap(s);
      expect(g.basis.u.some((c) => c > 0)).toBe(true);
      expect(g.basis.v.some((c) => c > 0)).toBe(true);
    }
  });

  it('moves along w after swapping', () => {
    const g = newGame();
    g.swap('u');
    expect(g.move(1, 0)).toBe(true);
    expect(g.pos).toEqual([5, 2, 1]);
  });
});

describe('level 1 solution', () => {
  it('reaches the goal through w = 1', () => {
    const g = newGame();
    let won = false;
    g.on((e) => e.type === 'win' && (won = true));
    g.swap('u'); // u = w
    g.move(1, 0); // w -> 1
    g.swap('u'); // u = x again
    for (let i = 0; i < 4; i++) expect(g.move(-1, 0)).toBe(true); // x 5 -> 1
    expect(g.move(0, 1)).toBe(true); // z 2 -> 3
    g.swap('u');
    g.move(-1, 0); // w -> 0
    expect(g.pos).toEqual([1, 3, 0]);
    expect(won).toBe(true);
  });
});
