import * as THREE from 'three';

/**
 * One kind of board piece (grass tile, wall, tree crown...) drawn as two instanced meshes:
 * a solid one for the current slice and a holographic one for neighbouring slices.
 */
export class PieceLayer {
  readonly solid: THREE.InstancedMesh;
  readonly ghost: THREE.InstancedMesh | null;
  private readonly alpha: THREE.InstancedBufferAttribute | null = null;
  private readonly tint: THREE.InstancedBufferAttribute | null = null;
  private ns = 0;
  private ng = 0;

  constructor(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    ghostMaterial: THREE.Material | null,
    capacity: number,
    opts: { castShadow?: boolean; receiveShadow?: boolean; colored?: boolean } = {},
  ) {
    this.solid = new THREE.InstancedMesh(geometry, material, capacity);
    this.solid.castShadow = opts.castShadow ?? true;
    this.solid.receiveShadow = opts.receiveShadow ?? true;
    this.solid.frustumCulled = false;
    if (opts.colored) {
      this.solid.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    }
    if (ghostMaterial) {
      const g = geometry.clone();
      this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
      this.tint = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
      g.setAttribute('aAlpha', this.alpha);
      g.setAttribute('aTint', this.tint);
      this.ghost = new THREE.InstancedMesh(g, ghostMaterial, capacity);
      this.ghost.frustumCulled = false;
      this.ghost.renderOrder = 10;
    } else {
      this.ghost = null;
    }
  }

  addTo(parent: THREE.Object3D): void {
    parent.add(this.solid);
    if (this.ghost) parent.add(this.ghost);
  }

  begin(): void {
    this.ns = 0;
    this.ng = 0;
  }

  pushSolid(m: THREE.Matrix4, color?: THREE.Color): void {
    this.solid.setMatrixAt(this.ns, m);
    if (color && this.solid.instanceColor) this.solid.setColorAt(this.ns, color);
    this.ns++;
  }

  pushGhost(m: THREE.Matrix4, alpha: number, tint: number): void {
    if (!this.ghost || !this.alpha || !this.tint) return;
    this.ghost.setMatrixAt(this.ng, m);
    this.alpha.setX(this.ng, alpha);
    this.tint.setX(this.ng, tint);
    this.ng++;
  }

  end(): void {
    this.solid.count = this.ns;
    this.solid.instanceMatrix.needsUpdate = true;
    if (this.solid.instanceColor) this.solid.instanceColor.needsUpdate = true;
    if (this.ghost && this.alpha && this.tint) {
      this.ghost.count = this.ng;
      this.ghost.instanceMatrix.needsUpdate = true;
      this.alpha.needsUpdate = true;
      this.tint.needsUpdate = true;
    }
  }
}
