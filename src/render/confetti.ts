import * as THREE from 'three';
import { mulberry } from './sky';

const COLORS = ['#ff8ad8', '#6fe3ff', '#ffd36b', '#94d46c', '#b59bff', '#ff9f6b'];

/** A burst of tumbling paper confetti. */
export class Confetti {
  readonly mesh: THREE.InstancedMesh;
  private readonly n: number;
  private readonly pos: THREE.Vector3[] = [];
  private readonly vel: THREE.Vector3[] = [];
  private readonly spin: THREE.Vector3[] = [];
  private readonly rot: THREE.Euler[] = [];
  private age = Infinity;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3(1, 1, 1);

  constructor(n = 160) {
    this.n = n;
    const geo = new THREE.PlaneGeometry(0.12, 0.07);
    const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6, emissiveIntensity: 0.3 });
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      this.mesh.setColorAt(i, c.set(COLORS[i % COLORS.length]));
      this.pos.push(new THREE.Vector3());
      this.vel.push(new THREE.Vector3());
      this.spin.push(new THREE.Vector3());
      this.rot.push(new THREE.Euler());
    }
  }

  burst(at: THREE.Vector3): void {
    const rnd = mulberry(Math.floor(Math.random() * 1e6));
    for (let i = 0; i < this.n; i++) {
      this.pos[i].copy(at);
      const a = rnd() * Math.PI * 2, up = 4 + rnd() * 4, out = 1 + rnd() * 2.5;
      this.vel[i].set(Math.cos(a) * out, up, Math.sin(a) * out);
      this.spin[i].set(rnd() * 12 - 6, rnd() * 12 - 6, rnd() * 12 - 6);
    }
    this.age = 0;
    this.mesh.visible = true;
  }

  update(dt: number): void {
    if (this.age > 4) {
      this.mesh.visible = false;
      return;
    }
    this.age += dt;
    for (let i = 0; i < this.n; i++) {
      const v = this.vel[i];
      v.y -= 9 * dt;
      v.multiplyScalar(1 - 1.8 * dt); // air drag: flutter down
      this.pos[i].addScaledVector(v, dt);
      const r = this.rot[i];
      r.set(r.x + this.spin[i].x * dt, r.y + this.spin[i].y * dt, r.z + this.spin[i].z * dt);
      this.q.setFromEuler(r);
      this.mesh.setMatrixAt(i, this.m.compose(this.pos[i], this.q, this.s));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
