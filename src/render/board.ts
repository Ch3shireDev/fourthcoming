import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Cell, hasGround, type Vec3i, type World } from '../world/world';
import { PieceLayer } from './layer';
import {
  PALETTE,
  beamMaterial,
  brickMaterial,
  dirtMaterial,
  ghostMaterial,
  grassMaterial,
} from './materials';
import type { V3, ViewAnimator } from './view';

const TILE_H = 0.34;
const WALL_H = 1.5;
const LOW_H = 0.8;

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const hash = (p: Vec3i, k = 0) => {
  const s = Math.sin(p[0] * 127.1 + p[1] * 311.7 + p[2] * 74.7 + k * 19.3) * 43758.5453;
  return s - Math.floor(s);
};

/** Renders the 4D grid as the animated 3D slice plus holographic neighbouring slices. */
export class Board {
  readonly group = new THREE.Group();
  private readonly world: World;
  private readonly center: V3;
  private readonly cells: { pos: Vec3i; cell: Cell }[];

  private readonly grass: PieceLayer;
  private readonly dirt: PieceLayer;
  private readonly wall: PieceLayer;
  private readonly lowWall: PieceLayer;
  private readonly trunk: PieceLayer;
  private readonly crown: PieceLayer;
  private readonly crownTop: PieceLayer;
  private readonly goalBase: PieceLayer;
  private readonly crystal: PieceLayer;
  private readonly beam: PieceLayer;
  private readonly layers: PieceLayer[];

  private readonly ghostMat = ghostMaterial();
  private readonly beamMat = beamMaterial();
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly tmpColor = new THREE.Color();
  private readonly grassColors = PALETTE.grassByW.map((c) => new THREE.Color(c));

  /** Scene position of the goal (for effects). */
  readonly goalScene = new THREE.Vector3();
  winT = -1;

  constructor(world: World) {
    this.world = world;
    this.center = world.size.map((s) => (s - 1) / 2) as V3;
    this.cells = [...world.each()].filter((c) => hasGround(c.cell));
    const n = this.cells.length;

    const tileGeo = new RoundedBoxGeometry(1, TILE_H, 1, 3, 0.09);
    const dirtGeo = new THREE.BoxGeometry(0.985, 1, 0.985);
    dirtGeo.translate(0, -0.5, 0);
    const wallGeo = new RoundedBoxGeometry(0.94, WALL_H, 0.94, 3, 0.12);
    const lowGeo = new RoundedBoxGeometry(0.94, LOW_H, 0.94, 3, 0.12);
    const trunkGeo = new THREE.CylinderGeometry(0.07, 0.11, 0.55, 8);
    const crownGeo = new THREE.IcosahedronGeometry(0.4, 1);
    const crownTopGeo = new THREE.IcosahedronGeometry(0.27, 1);
    const goalBaseGeo = new THREE.TorusGeometry(0.34, 0.06, 12, 40);
    goalBaseGeo.rotateX(Math.PI / 2);
    const crystalGeo = new THREE.OctahedronGeometry(0.26, 0);
    crystalGeo.scale(1, 1.45, 1);
    const beamGeo = new THREE.CylinderGeometry(0.3, 0.38, 3.2, 24, 1, true);
    beamGeo.translate(0, 1.6, 0);

    const leavesMat = new THREE.MeshStandardMaterial({ color: PALETTE.leaves, roughness: 0.7, flatShading: true });
    const goalMat = new THREE.MeshStandardMaterial({
      color: PALETTE.goal,
      emissive: PALETTE.goal,
      emissiveIntensity: 1.6,
      roughness: 0.2,
    });
    const crystalMat = new THREE.MeshPhysicalMaterial({
      color: '#bffcf4',
      emissive: PALETTE.goal,
      emissiveIntensity: 2.2,
      roughness: 0.1,
      clearcoat: 1,
      flatShading: true,
    });

    const g = this.ghostMat;
    this.grass = new PieceLayer(tileGeo, grassMaterial(TILE_H / 2), g, n, { colored: true });
    this.dirt = new PieceLayer(dirtGeo, dirtMaterial(), null, n, { castShadow: false });
    this.wall = new PieceLayer(wallGeo, brickMaterial(), g, n);
    this.lowWall = new PieceLayer(lowGeo, brickMaterial(), g, n);
    this.trunk = new PieceLayer(trunkGeo, new THREE.MeshStandardMaterial({ color: PALETTE.trunk, roughness: 0.9 }), g, n);
    this.crown = new PieceLayer(crownGeo, leavesMat, g, n);
    this.crownTop = new PieceLayer(crownTopGeo, leavesMat, g, n);
    this.goalBase = new PieceLayer(goalBaseGeo, goalMat, g, n, { castShadow: false });
    this.crystal = new PieceLayer(crystalGeo, crystalMat, g, n);
    this.beam = new PieceLayer(beamGeo, this.beamMat, null, n, { castShadow: false, receiveShadow: false });
    this.beam.solid.renderOrder = 20;
    this.layers = [
      this.grass, this.dirt, this.wall, this.lowWall, this.trunk,
      this.crown, this.crownTop, this.goalBase, this.crystal, this.beam,
    ];
    for (const l of this.layers) l.addTo(this.group);
  }

  private put(x: number, y: number, z: number, sx: number, sy = sx, sz = sx, rotY = 0): THREE.Matrix4 {
    this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rotY);
    return this.m.compose(new THREE.Vector3(x, y, z), this.q, new THREE.Vector3(sx, sy, sz));
  }

  /** Scene (x, z) of a 4D point under the current view. */
  project(p: V3, view: ViewAnimator): [number, number] {
    const rel: V3 = [p[0] - this.center[0], p[1] - this.center[1], p[2] - this.center[2]];
    return [dot(rel, view.eU), dot(rel, view.eV)];
  }

  update(view: ViewAnimator, time: number): void {
    this.ghostMat.uniforms.uTime.value = time;
    this.beamMat.uniforms.uTime.value = time;
    for (const l of this.layers) l.begin();

    const half = this.center;
    const absDot = (e: V3) => Math.abs(e[0]) * half[0] + Math.abs(e[1]) * half[1] + Math.abs(e[2]) * half[2];
    const hu = absDot(view.eU) + 0.5;
    const hv = absDot(view.eV) + 0.5;
    const hiddenAxis = view.eH.map(Math.abs).indexOf(Math.max(...view.eH.map(Math.abs)));
    const win = this.winT >= 0 ? Math.min(1, (time - this.winT) / 1.2) : 0;

    for (const { pos, cell } of this.cells) {
      const p: V3 = [pos[0], pos[1], pos[2]];
      const [X, Z] = this.project(p, view);
      const rel: V3 = [p[0] - view.player[0], p[1] - view.player[1], p[2] - view.player[2]];
      const H = dot(rel, view.eH);
      const aH = Math.abs(H);
      const solid = smooth(0.62, 0.28, aH);
      const ghost = smooth(1.75, 1.05, aH) * smooth(0.3, 0.8, aH);
      const tint = Math.sign(rel[hiddenAxis]) || 1;
      const phase = hash(pos) * 6.283;

      if (solid > 0.002) {
        const s = solid;
        const sink = (1 - s) * 0.6;
        // grass tile
        this.tmpColor.copy(this.grassColors[pos[2] % this.grassColors.length]);
        this.tmpColor.offsetHSL(0, 0, (hash(pos, 1) - 0.5) * 0.05 + ((pos[0] + pos[1] + pos[2]) % 2) * 0.015);
        this.grass.pushSolid(this.put(X, -TILE_H / 2 - sink, Z, s), this.tmpColor);
        // dirt column: deeper towards the middle of the island, ragged underside
        const edge = Math.max(0, Math.min(hu - Math.abs(X), hv - Math.abs(Z)));
        const depth = 0.7 + hash(pos, 2) * 0.55 + Math.min(edge, 3.2) * (0.55 + hash(pos, 3) * 0.45);
        this.dirt.pushSolid(this.put(X, -TILE_H + 0.02 - sink, Z, s, depth * s, s));
        this.pushObject(cell, X, Z, s, sink, phase, time, win, false, 0, 0);
      }
      if (ghost > 0.01 && solid < 0.99) {
        const lift = 0.08 + 0.05 * Math.sin(time * 1.6 + phase);
        // ghost floor only where the current slice has no ground beneath
        const q: Vec3i = [
          Math.round(p[0] - H * view.eH[0]),
          Math.round(p[1] - H * view.eH[1]),
          Math.round(p[2] - H * view.eH[2]),
        ];
        if (!hasGround(this.world.get(q))) {
          this.grass.pushGhost(this.put(X, -TILE_H / 2 + lift, Z, 0.92), ghost * 0.8, tint);
        }
        this.pushObject(cell, X, Z, 0.92, -lift, phase, time, 0, true, ghost, tint);
      }
    }
    for (const l of this.layers) l.end();
  }

  private pushObject(
    cell: Cell, X: number, Z: number, s: number, sink: number, phase: number,
    time: number, win: number, ghost: boolean, alpha: number, tint: number,
  ): void {
    const push = (layer: PieceLayer, m: THREE.Matrix4) =>
      ghost ? layer.pushGhost(m, alpha, tint) : layer.pushSolid(m);
    switch (cell) {
      case Cell.Wall:
        push(this.wall, this.put(X, WALL_H / 2 - sink, Z, s));
        break;
      case Cell.LowWall:
        push(this.lowWall, this.put(X, LOW_H / 2 - sink, Z, s));
        break;
      case Cell.Tree: {
        const sway = Math.sin(time * 1.3 + phase) * 0.04;
        push(this.trunk, this.put(X, 0.27 * s - sink, Z, s));
        push(this.crown, this.put(X + sway, 0.78 * s - sink, Z, s, s, s, phase));
        push(this.crownTop, this.put(X + sway * 1.6, 1.16 * s - sink, Z, s, s, s, -phase));
        break;
      }
      case Cell.Goal: {
        const bob = Math.sin(time * 2.1) * 0.09;
        const pulse = 1 + 0.08 * Math.sin(time * 4.0);
        push(this.goalBase, this.put(X, 0.03 - sink, Z, s * pulse * (1 + win * 1.5)));
        const cs = s * (1 + win * 0.8);
        push(this.crystal, this.put(X, 0.95 + bob + win * 1.2 - sink, Z, cs, cs, cs, time * 1.2 + win * 12));
        if (!ghost) {
          this.beam.pushSolid(this.put(X, -sink, Z, s * (1 + win), s * (1 + win * 2), s * (1 + win)));
          this.goalScene.set(X, 0.95, Z);
        }
        break;
      }
      default:
        break;
    }
  }
}
