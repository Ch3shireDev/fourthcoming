import { isWalkable, Cell, type Vec3i } from '../world/world';
import type { Level } from '../world/parse';

/** A view slot: 'u' and 'v' are the two visible horizontal axes, 'h' is hidden. */
export type Slot = 'u' | 'v' | 'h';

/** Signed unit vectors in (x, z, w) space describing what each slot shows. */
export interface Basis {
  u: Vec3i;
  v: Vec3i;
  h: Vec3i;
}

export type GameEvent =
  | { type: 'move'; from: Vec3i; to: Vec3i }
  | { type: 'bump'; dir: Vec3i }
  | { type: 'swap'; slot: 'u' | 'v'; from: Basis; to: Basis }
  | { type: 'win' }
  | { type: 'reset' };

const add = (a: Vec3i, b: Vec3i, k = 1): Vec3i => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const neg = (a: Vec3i): Vec3i => [-a[0] || 0, -a[1] || 0, -a[2] || 0];

export function axisOf(v: Vec3i): number {
  return v.findIndex((c) => c !== 0);
}

export class Game {
  readonly level: Level;
  pos: Vec3i;
  basis: Basis;
  moves = 0;
  won = false;
  private listeners: ((e: GameEvent) => void)[] = [];

  constructor(level: Level) {
    this.level = level;
    this.pos = [...level.start] as Vec3i;
    this.basis = Game.initialBasis();
  }

  static initialBasis(): Basis {
    return { u: [1, 0, 0], v: [0, 1, 0], h: [0, 0, 1] };
  }

  on(fn: (e: GameEvent) => void): void {
    this.listeners.push(fn);
  }

  private emit(e: GameEvent): void {
    for (const fn of this.listeners) fn(e);
  }

  /** Step one cell along the visible slots. Returns true if the player moved. */
  move(du: number, dv: number): boolean {
    if (this.won) return false;
    const dir = add(add([0, 0, 0], this.basis.u, du), this.basis.v, dv);
    const to = add(this.pos, dir);
    if (!isWalkable(this.level.world.get(to))) {
      this.emit({ type: 'bump', dir });
      return false;
    }
    const from = this.pos;
    this.pos = to;
    this.moves++;
    this.emit({ type: 'move', from, to });
    if (this.level.world.get(to) === Cell.Goal) {
      this.won = true;
      this.emit({ type: 'win' });
    }
    return true;
  }

  /**
   * Rotate a visible slot into the hidden dimension by 90°: the slot now shows the hidden
   * axis, and its old axis becomes hidden. The rotation direction is chosen so that the
   * visible slot always shows a positive axis; this way the slice is never seen mirrored
   * and pressing swap twice returns to the original view.
   * The player does not move in 4D, so this can never put them inside a wall.
   */
  swap(slot: 'u' | 'v'): void {
    if (this.won) return;
    const from = { ...this.basis };
    const h = this.basis.h;
    const positive = h[axisOf(h)] > 0;
    const to: Basis = positive
      ? { ...this.basis, [slot]: h, h: neg(this.basis[slot]) } // +90°
      : { ...this.basis, [slot]: neg(h), h: this.basis[slot] }; // -90°
    this.basis = to;
    this.emit({ type: 'swap', slot, from, to });
  }

  reset(): void {
    this.pos = [...this.level.start] as Vec3i;
    this.basis = Game.initialBasis();
    this.moves = 0;
    this.won = false;
    this.emit({ type: 'reset' });
  }

  /** Coordinate of the player along the hidden axis. */
  hiddenValue(): number {
    return this.pos[axisOf(this.basis.h)];
  }
}
