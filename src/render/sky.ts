import * as THREE from 'three';

/** Full-screen gradient sky with a soft sun glow, drawn behind everything. */
export function createSky(): { mesh: THREE.Mesh; material: THREE.ShaderMaterial } {
  const material = new THREE.ShaderMaterial({
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uTime: { value: 0 },
      uShift: { value: 0 },
      uPulse: { value: 0 },
      uAspect: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.9999, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uShift;
      uniform float uPulse;
      uniform float uAspect;
      varying vec2 vUv;
      vec3 hueShift(vec3 c, float a) {
        const vec3 k = vec3(0.57735);
        float ca = cos(a);
        return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);
      }
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec3 top = vec3(0.38, 0.55, 0.92);
        vec3 mid = vec3(0.74, 0.80, 0.98);
        vec3 low = vec3(1.00, 0.84, 0.78);
        float y = vUv.y;
        vec3 col = mix(low, mid, smoothstep(0.0, 0.55, y));
        col = mix(col, top, smoothstep(0.55, 1.05, y));
        vec2 p = vec2((vUv.x - 0.5) * uAspect, vUv.y);
        float sun = exp(-12.0 * distance(p, vec2(-0.35 * uAspect, 0.82)));
        col += vec3(1.0, 0.85, 0.6) * sun * 0.55;
        col = hueShift(col, uShift * 0.32 + uPulse * 0.6);
        col += (hash(vUv * 900.0 + uTime) - 0.5) * 0.012; // dither, avoids banding
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return { mesh, material };
}

/** Puffy instanced clouds drifting around and below the island. */
export class Clouds {
  readonly mesh: THREE.InstancedMesh;
  private readonly puffs: { base: THREE.Vector3; r: number; cloud: number }[] = [];
  private readonly drift: { speed: number; offset: number }[] = [];
  private readonly m = new THREE.Matrix4();

  constructor(count = 18) {
    const rnd = mulberry(7);
    for (let c = 0; c < count; c++) {
      const angle = rnd() * Math.PI * 2;
      const dist = 7 + rnd() * 11;
      const center = new THREE.Vector3(Math.cos(angle) * dist, -4.5 - rnd() * 6, Math.sin(angle) * dist);
      const size = 0.7 + rnd() * 1.0;
      const n = 5 + Math.floor(rnd() * 5);
      for (let i = 0; i < n; i++) {
        const t = (i / (n - 1) - 0.5) * 2;
        this.puffs.push({
          base: center.clone().add(new THREE.Vector3(t * size * 1.6, (1 - t * t) * size * 0.35 + rnd() * 0.2, (rnd() - 0.5) * size)),
          r: size * (0.55 + (1 - Math.abs(t)) * 0.55 + rnd() * 0.2),
          cloud: c,
        });
      }
      this.drift.push({ speed: 0.12 + rnd() * 0.18, offset: rnd() * 40 });
    }
    const geo = new THREE.IcosahedronGeometry(1, 3);
    const mat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#ffe8ef',
      emissiveIntensity: 0.35,
      roughness: 1,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.puffs.length);
    this.mesh.frustumCulled = false;
    this.update(0);
  }

  update(time: number): void {
    const span = 40;
    this.puffs.forEach((p, i) => {
      const d = this.drift[p.cloud];
      let x = p.base.x + ((time * d.speed + d.offset) % span) - span / 2;
      x = ((x + span / 2) % span + span) % span - span / 2;
      const breathe = 1 + 0.03 * Math.sin(time * 0.6 + i);
      this.m.makeScale(p.r * breathe, p.r * 0.82 * breathe, p.r * breathe);
      this.m.setPosition(x, p.base.y + Math.sin(time * 0.3 + p.cloud) * 0.15, p.base.z);
      this.mesh.setMatrixAt(i, this.m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Slowly rising, twinkling motes of light. */
export function createSparkles(count = 140): { points: THREE.Points; material: THREE.ShaderMaterial } {
  const rnd = mulberry(3);
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rnd() - 0.5) * 22;
    pos[i * 3 + 1] = (rnd() - 0.5) * 10;
    pos[i * 3 + 2] = (rnd() - 0.5) * 22;
    seed[i] = rnd();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vTw;
      void main() {
        vec3 p = position;
        p.y = mod(p.y + uTime * (0.15 + aSeed * 0.25) + 5.0, 10.0) - 5.0;
        p.x += sin(uTime * 0.5 + aSeed * 40.0) * 0.3;
        vTw = 0.5 + 0.5 * sin(uTime * (1.5 + aSeed * 3.0) + aSeed * 60.0);
        vTw *= smoothstep(5.0, 3.0, abs(p.y));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (2.0 + aSeed * 4.0) * uPixelRatio;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vTw;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vTw;
        gl_FragColor = vec4(vec3(1.0, 0.95, 0.8) * a, a);
      }
    `,
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  return { points, material };
}

export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
