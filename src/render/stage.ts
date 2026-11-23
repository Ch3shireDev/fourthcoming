import * as THREE from 'three';
import {
  BloomEffect,
  ChromaticAberrationEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAEffect,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** Renderer, isometric camera, lights and the post-processing chain. */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  readonly composer: EffectComposer;
  readonly sun: THREE.DirectionalLight;
  private readonly chroma: ChromaticAberrationEffect;
  private readonly ao: N8AOPostPass;
  /** Half of the visible world height. */
  viewHalf = 6.2;
  zoom = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      stencil: false,
      depth: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this.camera.position.set(20, 17, 20);
    this.camera.lookAt(0, -0.6, 0);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.35;
    this.scene.fog = new THREE.Fog('#f6d4cc', 38, 75);

    this.scene.add(new THREE.HemisphereLight('#cfe0ff', '#f3c1a6', 1.4));
    this.sun = new THREE.DirectionalLight('#fff0d6', 3.2);
    this.sun.position.set(-6, 14, 9);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -9;
    sc.right = sc.top = 9;
    sc.near = 1;
    sc.far = 40;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.025;
    this.sun.shadow.radius = 3;
    this.scene.add(this.sun);
    // soft rim light from behind for that diorama glow
    const rim = new THREE.DirectionalLight('#ffd1e8', 1.1);
    rim.position.set(-8, 5, -10);
    this.scene.add(rim);

    this.composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.ao = new N8AOPostPass(this.scene, this.camera, 1, 1);
    Object.assign(this.ao.configuration, {
      aoRadius: 1.4,
      distanceFalloff: 0.6,
      intensity: 2.6,
      gammaCorrection: false,
      halfRes: false,
    });
    this.ao.configuration.color.set('#3a2350');
    this.ao.setQualityMode('Medium');
    this.composer.addPass(this.ao);

    const bloom = new BloomEffect({
      intensity: 0.9,
      luminanceThreshold: 0.82,
      luminanceSmoothing: 0.25,
      mipmapBlur: true,
      radius: 0.7,
    });
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL });
    const vignette = new VignetteEffect({ offset: 0.32, darkness: 0.42 });
    this.composer.addPass(new EffectPass(this.camera, bloom, tone, vignette));
    this.composer.addPass(new EffectPass(this.camera, new SMAAEffect()));
    this.chroma = new ChromaticAberrationEffect({
      offset: new THREE.Vector2(0, 0),
      radialModulation: true,
      modulationOffset: 0.2,
    });
    this.composer.addPass(new EffectPass(this.camera, this.chroma));

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.updateProjection();
  }

  updateProjection(): void {
    const w = window.innerWidth, h = window.innerHeight;
    if (w === 0 || h === 0) return; // hidden tab / pane: keep the last valid projection
    const aspect = w / h;
    // keep the board fully visible in portrait
    const half = (this.viewHalf * Math.max(1, 1.25 / aspect)) / this.zoom;
    this.camera.left = -half * aspect;
    this.camera.right = half * aspect;
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.updateProjectionMatrix();
  }

  /** Strength 0..1 of the chromatic "dimension shift" effect. */
  setShift(k: number): void {
    this.chroma.offset.set(0.004 * k, 0.0025 * k);
  }

  render(dt: number): void {
    this.composer.render(dt);
  }
}
