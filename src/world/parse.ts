import { Cell, World, type Vec3i } from './world';

/**
 * A level is a list of w-slices. Each slice is a list of rows (z), each row a string
 * of cells (x).
 *
 *   ' ' void   '.' floor   '#' wall   'h' low wall   'T' tree   'G' goal   'S' start
 */
export interface LevelData {
  name: string;
  subtitle: string;
  slices: string[][];
}

export interface Level {
  name: string;
  subtitle: string;
  world: World;
  start: Vec3i;
}

const CHARS: Record<string, Cell> = {
  ' ': Cell.Void,
  '.': Cell.Floor,
  S: Cell.Floor,
  '#': Cell.Wall,
  h: Cell.LowWall,
  T: Cell.Tree,
  G: Cell.Goal,
};

export function parseLevel(data: LevelData): Level {
  const sw = data.slices.length;
  const sz = Math.max(...data.slices.map((s) => s.length));
  const sx = Math.max(...data.slices.flatMap((s) => s.map((r) => r.length)));
  const world = new World([sx, sz, sw]);
  let start: Vec3i | null = null;

  data.slices.forEach((slice, w) =>
    slice.forEach((row, z) =>
      [...row].forEach((ch, x) => {
        const cell = CHARS[ch];
        if (cell === undefined) throw new Error(`unknown cell '${ch}' at ${x},${z},${w}`);
        world.set([x, z, w], cell);
        if (ch === 'S') {
          if (start) throw new Error('level has more than one start');
          start = [x, z, w];
        }
      }),
    ),
  );

  if (!start) throw new Error('level has no start');
  return { name: data.name, subtitle: data.subtitle, world, start };
}
