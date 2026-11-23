import * as THREE from 'three';
import type { ViewAnimator } from './view';

/** A round, cheerful little blob with eyes that hops from tile to tile. */
export class Player {
  readonly group = new THREE.Group();
  private readonly body = new THREE.Group();
  private facing = 0;
  private blinkAt = 2;
  private readonly eyes: THREE.Group[] = [];

  constructor() {
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: '#ffc46b',
      roughness: 0.45,
      sheen: 1,
      sheenColor: new THREE.Color('#fff2c8'),
      sheenRoughness: 0.5,
      clearcoat: 0.4,
    });
    const blob = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 24), bodyMat);
    blob.scale.set(1, 0.92, 1);
    blob.position.y = 0.3;
    blob.castShadow = true;
    this.body.add(blob);

    const white = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 });
    const black = new THREE.MeshStandardMaterial({ color: '#2b2140', roughness: 0.2 });
    const cheek = new THREE.MeshBasicMaterial({ color: '#ff8fa3', transparent: true, opacity: 0.7 });
    for (const side of [-1, 1]) {
      const eye = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), white);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), black);
      pupil.position.z = 0.045;
      eye.add(ball, pupil);
      eye.position.set(side * 0.11, 0.38, 0.24);
      this.body.add(eye);
      this.eyes.push(eye);
      const c = new THREE.Mesh(new THREE.CircleGeometry(0.045, 16), cheek);
      c.position.set(side * 0.19, 0.29, 0.245);
      c.rotation.y = side * 0.5;
      this.body.add(c);
    }
    this.group.add(this.body);
  }

  update(view: ViewAnimator, scene: [number, number], time: number, dt: number, won: boolean): void {
    const hop = view.hop();
    let bx = 0, bz = 0;
    if (view.bumpT < 1) {
      // small nudge towards the blocked direction, then back
      const k = Math.sin(view.bumpT * Math.PI) * 0.18;
      const d = view.bumpDir;
      const dx = d[0] * view.eU[0] + d[1] * view.eU[1] + d[2] * view.eU[2];
      const dz = d[0] * view.eV[0] + d[1] * view.eV[1] + d[2] * view.eV[2];
      bx = dx * k;
      bz = dz * k;
    }
    this.group.position.set(scene[0] + bx, hop, scene[1] + bz);

    // face movement direction
    const target = Math.atan2(view.lastMove[0], view.lastMove[2]);
    let diff = target - this.facing;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.facing += diff * Math.min(1, dt * 14);
    this.body.rotation.y = this.facing + (won ? time * 8 : 0);

    // squash & stretch
    const landing = view.moveT < 1 ? Math.sin(view.moveT * Math.PI) : 0;
    const breathe = Math.sin(time * 3) * 0.025;
    const sy = 1 + landing * 0.14 + breathe;
    const sxz = 1 - landing * 0.07 - breathe * 0.5;
    this.body.scale.set(sxz, sy, sxz);
    if (won) this.group.position.y += Math.abs(Math.sin(time * 6)) * 0.4;

    // blink
    if (time > this.blinkAt + 0.12) this.blinkAt = time + 2 + Math.random() * 3;
    const closed = time > this.blinkAt && time < this.blinkAt + 0.12;
    for (const e of this.eyes) e.scale.y = closed ? 0.15 : 1;
  }
}
