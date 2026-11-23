/**
 * 4D grid world. Horizontal axes are indexed 0 = x, 1 = z, 2 = w.
 * The vertical axis (y) is not part of the grid: it only gives objects height.
 */

export type Vec3i = [number, number, number];

export const AXIS_NAMES = ['X', 'Z', 'W'] as const;

export enum Cell {
  Void = 0,
  Floor = 1,
  Wall = 2,
  LowWall = 3,
  Tree = 4,
  Goal = 5,
}

/** Cells that have ground under them (everything except the void). */
export function hasGround(c: Cell): boolean {
  return c !== Cell.Void;
}

/** Cells the player may stand on. */
export function isWalkable(c: Cell): boolean {
  return c === Cell.Floor || c === Cell.Goal;
}

export class World {
  readonly size: Vec3i;
  private readonly cells: Uint8Array;

  constructor(size: Vec3i) {
    this.size = [...size] as Vec3i;
    this.cells = new Uint8Array(size[0] * size[1] * size[2]);
  }

  inBounds(p: Vec3i): boolean {
    return p.every((v, i) => Number.isInteger(v) && v >= 0 && v < this.size[i]);
  }

  private index(p: Vec3i): number {
    return p[0] + this.size[0] * (p[1] + this.size[1] * p[2]);
  }

  get(p: Vec3i): Cell {
    return this.inBounds(p) ? (this.cells[this.index(p)] as Cell) : Cell.Void;
  }

  set(p: Vec3i, c: Cell): void {
    if (!this.inBounds(p)) throw new Error(`out of bounds: ${p}`);
    this.cells[this.index(p)] = c;
  }

  /** Iterate over every cell of the box. */
  *each(): Generator<{ pos: Vec3i; cell: Cell }> {
    const [sx, sz, sw] = this.size;
    for (let w = 0; w < sw; w++)
      for (let z = 0; z < sz; z++)
        for (let x = 0; x < sx; x++) {
          const pos: Vec3i = [x, z, w];
          yield { pos, cell: this.get(pos) };
        }
  }
}
