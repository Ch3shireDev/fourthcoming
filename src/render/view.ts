import type { Basis, GameEvent } from '../game/game';
import type { Vec3i } from '../world/world';

export type V3 = [number, number, number];

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t: number) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

const SWAP_TIME = 0.75;
const MOVE_TIME = 0.17;
const YAW_TIME = 0.45;
const BUMP_TIME = 0.22;

const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const f = (v: Vec3i): V3 => [v[0], v[1], v[2]];

/**
 * The displayed (animated) view of the game state: the basis vectors of the visible slice,
 * the board yaw and the player's interpolated 4D position.
 */
export class ViewAnimator {
  eU: V3;
  eV: V3;
  eH: V3;
  private from: Basis;
  private to: Basis;
  private swapSlot: 'u' | 'v' = 'u';
  swapT = 1;

  yaw = 0;
  private yawFrom = 0;
  yawTarget = 0;
  private yawT = 1;

  player: V3;
  private pFrom: V3;
  private pTo: V3;
  moveT = 1;
  /** Scene-space direction of the last move (for facing). */
  lastMove: V3 = [0, 0, 1];

  bumpT = 1;
  bumpDir: V3 = [0, 0, 0];

  constructor(basis: Basis, pos: Vec3i) {
    this.from = basis;
    this.to = basis;
    this.eU = f(basis.u);
    this.eV = f(basis.v);
    this.eH = f(basis.h);
    this.player = f(pos);
    this.pFrom = f(pos);
    this.pTo = f(pos);
  }

  busy(): boolean {
    return this.swapT < 1 || this.moveT < 1 || this.yawT < 1;
  }

  /** 0..1 strength of the "dimension shift" effect (peaks mid-swap). */
  swapPulse(): number {
    return this.swapT < 1 ? Math.sin(this.swapT * Math.PI) : 0;
  }

  handle(e: GameEvent, basis: Basis, pos: Vec3i): void {
    switch (e.type) {
      case 'move':
        this.pFrom = [...this.player];
        this.pTo = f(e.to);
        this.moveT = 0;
        {
          const d: V3 = [e.to[0] - e.from[0], e.to[1] - e.from[1], e.to[2] - e.from[2]];
          const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
          this.lastMove = [dot(d, this.eU), 0, dot(d, this.eV)];
        }
        break;
      case 'bump':
        this.bumpDir = f(e.dir);
        this.bumpT = 0;
        break;
      case 'swap':
        this.from = e.from;
        this.to = e.to;
        this.swapSlot = e.slot;
        this.swapT = 0;
        break;
      case 'reset':
        this.from = this.to = basis;
        this.eU = f(basis.u);
        this.eV = f(basis.v);
        this.eH = f(basis.h);
        this.player = this.pFrom = this.pTo = f(pos);
        this.swapT = this.moveT = this.bumpT = 1;
        break;
      case 'win':
        break;
    }
  }

  rotateYaw(dir: number): void {
    this.yawFrom = this.yaw;
    this.yawTarget += (dir * Math.PI) / 2;
    this.yawT = 0;
  }

  update(dt: number): void {
    if (this.swapT < 1) {
      this.swapT = Math.min(1, this.swapT + dt / SWAP_TIME);
      const a = (easeInOutCubic(this.swapT) * Math.PI) / 2;
      const c = Math.cos(a), s = Math.sin(a);
      const k = this.swapSlot;
      const e0 = f(this.from[k]), e1 = f(this.to[k]);
      const h0 = f(this.from.h), h1 = f(this.to.h);
      const e: V3 = [c * e0[0] + s * e1[0], c * e0[1] + s * e1[1], c * e0[2] + s * e1[2]];
      const h: V3 = [c * h0[0] + s * h1[0], c * h0[1] + s * h1[1], c * h0[2] + s * h1[2]];
      if (k === 'u') this.eU = e;
      else this.eV = e;
      this.eH = h;
    }
    if (this.moveT < 1) {
      this.moveT = Math.min(1, this.moveT + dt / MOVE_TIME);
      this.player = lerp3(this.pFrom, this.pTo, easeInOutCubic(this.moveT));
    }
    if (this.yawT < 1) {
      this.yawT = Math.min(1, this.yawT + dt / YAW_TIME);
      this.yaw = this.yawFrom + (this.yawTarget - this.yawFrom) * easeOutBack(this.yawT);
    }
    if (this.bumpT < 1) this.bumpT = Math.min(1, this.bumpT + dt / BUMP_TIME);
  }

  /** Hop height of the player for the current move. */
  hop(): number {
    return this.moveT < 1 ? Math.sin(this.moveT * Math.PI) * 0.32 : 0;
  }
}
