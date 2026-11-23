import * as THREE from 'three';

/** Colors shared by the board and the HUD. */
export const PALETTE = {
  /** Grass tint per absolute w coordinate, so the w axis is readable once it is visible. */
  grassByW: ['#94d46c', '#6fcfa6', '#a7b8f0', '#e0b0d8'],
  wall: '#e07a5a',
  trunk: '#8a5a44',
  leaves: '#ff9bb8',
  goal: '#5ef2e0',
  ana: '#6fe3ff', // +hidden
  kata: '#ff8ad8', // -hidden
};

/**
 * Inject `vFcWorld` (world position) and `vFcLocal` (object-space position before instancing)
 * varyings into a built-in material, then let `patchFragment` edit `diffuseColor`.
 */
function withPositions(
  mat: THREE.MeshStandardMaterial,
  key: string,
  fragmentHead: string,
  fragmentBody: string,
): THREE.MeshStandardMaterial {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFcWorld;\nvarying vec3 vFcLocal;')
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vec4 fcW = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          fcW = instanceMatrix * fcW;
        #endif
        vFcWorld = (modelMatrix * fcW).xyz;
        vFcLocal = transformed;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vFcWorld;
        varying vec3 vFcLocal;
        float fcHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float fcNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(fcHash(i), fcHash(i + vec2(1, 0)), u.x),
                     mix(fcHash(i + vec2(0, 1)), fcHash(i + vec2(1, 1)), u.x), u.y);
        }
        ${fragmentHead}`,
      )
      .replace('#include <color_fragment>', `#include <color_fragment>\n${fragmentBody}`);
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}

/** Grass tile: grassy top with a wavy overhang onto a dirt rim. Instance color = grass tint. */
export function grassMaterial(tileHalfHeight: number): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 });
  return withPositions(
    m,
    'fc-grass',
    '',
    `{
      vec3 grass = diffuseColor.rgb;
      float n = fcNoise(vFcWorld.xz * 6.0);
      float speck = step(0.93, fcHash(floor(vFcWorld.xz * 14.0)));
      grass *= 0.92 + 0.14 * n;
      grass = mix(grass, grass * vec3(1.15, 1.18, 0.9), speck * 0.6);
      float edge = ${tileHalfHeight.toFixed(3)} * 0.15
        + 0.035 * sin(vFcWorld.x * 11.0 + vFcWorld.z * 7.0)
        + 0.025 * sin(vFcWorld.z * 17.0 - vFcWorld.x * 5.0);
      vec3 dirt = vec3(0.62, 0.40, 0.28) * (0.9 + 0.2 * n);
      float isGrass = smoothstep(edge - 0.015, edge + 0.015, vFcLocal.y);
      diffuseColor.rgb = mix(dirt, grass, isGrass);
    }`,
  );
}

/** Dirt column under the grass: warm strata that darken towards the bottom. */
export function dirtMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
  return withPositions(
    m,
    'fc-dirt',
    '',
    `{
      float y = vFcWorld.y;
      float band = fcNoise(vec2(y * 2.2, (vFcWorld.x + vFcWorld.z) * 0.6));
      vec3 a = vec3(0.70, 0.45, 0.31);
      vec3 b = vec3(0.55, 0.34, 0.26);
      vec3 deep = vec3(0.42, 0.30, 0.38);
      vec3 col = mix(a, b, smoothstep(0.35, 0.65, band));
      col = mix(col, deep, clamp(-y * 0.22, 0.0, 0.85));
      float pebble = step(0.965, fcHash(floor(vec2(y * 9.0, (vFcWorld.x - vFcWorld.z) * 9.0))));
      col = mix(col, vec3(0.85, 0.78, 0.70), pebble * 0.5);
      diffuseColor.rgb = col;
    }`,
  );
}

/** Rounded terracotta bricks with mortar lines, computed from object-space position. */
export function brickMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: PALETTE.wall, roughness: 0.8, metalness: 0 });
  return withPositions(
    m,
    'fc-brick',
    '',
    `{
      float rows = 3.2;
      float ry = vFcLocal.y * rows;
      float row = floor(ry);
      float along = (vFcLocal.x + vFcLocal.z) * 2.4 + mod(row, 2.0) * 0.5;
      float brick = floor(along);
      float mortar = max(step(fract(ry), 0.07), step(fract(along), 0.05));
      float v = fcHash(vec2(row, brick));
      vec3 col = diffuseColor.rgb * (0.88 + 0.22 * v);
      col = mix(col, vec3(0.96, 0.86, 0.76), mortar * 0.75);
      // sun-bleached top
      col = mix(col, col * 1.12, smoothstep(0.6, 1.0, vNormal.y));
      diffuseColor.rgb = col;
    }`,
  );
}

/** Holographic material for cells from neighbouring slices. Per-instance alpha and tint. */
export function ghostMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uAna: { value: new THREE.Color(PALETTE.ana) },
      uKata: { value: new THREE.Color(PALETTE.kata) },
    },
    vertexShader: /* glsl */ `
      attribute float aAlpha;
      attribute float aTint;
      varying float vAlpha;
      varying float vTint;
      varying vec3 vN;
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
        vAlpha = aAlpha;
        vTint = aTint;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uAna;
      uniform vec3 uKata;
      varying float vAlpha;
      varying float vTint;
      varying vec3 vN;
      varying vec3 vWorld;
      void main() {
        float rim = pow(1.0 - abs(normalize(vN).z), 1.6);
        vec3 col = mix(uKata, uAna, step(0.0, vTint));
        float scan = 0.7 + 0.3 * sin(vWorld.y * 26.0 - uTime * 3.0);
        float a = vAlpha * (0.16 + 0.62 * rim) * scan;
        gl_FragColor = vec4(col * (0.85 + rim * 0.9), a);
      }
    `,
  });
}

/** Soft vertical light beam above the goal, additive. */
export function beamMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(PALETTE.goal) } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float fade = pow(1.0 - vUv.y, 1.8);
        float stripes = 0.6 + 0.4 * sin(vUv.y * 30.0 - uTime * 4.0 + vUv.x * 6.2831);
        gl_FragColor = vec4(uColor * fade * stripes * 0.55, 1.0);
      }
    `,
  });
}
