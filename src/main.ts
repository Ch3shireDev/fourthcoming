import * as THREE from 'three';
import './style.css';
import { Game, axisOf } from './game/game';
import { parseLevel } from './world/parse';
import { Cell } from './world/world';
import { level1 } from './levels/level1';
import { Stage } from './render/stage';
import { Board } from './render/board';
import { Player } from './render/player';
import { ViewAnimator } from './render/view';
import { Clouds, createSky, createSparkles } from './render/sky';
import { Confetti } from './render/confetti';
import { Hud, type Action } from './ui/hud';

const level = parseLevel(level1);
const game = new Game(level);

const stage = new Stage(document.getElementById('c') as HTMLCanvasElement);
const sky = createSky();
stage.scene.add(sky.mesh);
const clouds = new Clouds();
stage.scene.add(clouds.mesh);
const sparkles = createSparkles();
sparkles.material.uniforms.uPixelRatio.value = stage.renderer.getPixelRatio();
stage.scene.add(sparkles.points);

const board = new Board(level.world);
stage.scene.add(board.group);
const player = new Player();
board.group.add(player.group);
const confetti = new Confetti();
stage.scene.add(confetti.mesh);

const view = new ViewAnimator(game.basis, game.pos);

// --- hints -----------------------------------------------------------------
let wallBumps = 0;
let swaps = 0;
let startTime = performance.now();
let hintShown = '';
function setHint(id: string, html: string | null) {
  if (hintShown === id) return;
  hintShown = id;
  hud.showHint(html);
}

// --- input -----------------------------------------------------------------
let queued: Action | null = null;
const hud = new Hud(document.getElementById('hud')!, level.name, level.subtitle, (a) => act(a));

/** World-space screen directions for the isometric camera (camera sits at +x, +z). */
const SCREEN_DIRS = {
  dr: new THREE.Vector3(1, 0, 0),
  dl: new THREE.Vector3(0, 0, 1),
  ur: new THREE.Vector3(0, 0, -1),
  ul: new THREE.Vector3(-1, 0, 0),
};

/** Convert a world direction into board-local slots (u along local x, v along local z). */
function toLocal(d: THREE.Vector3, yaw: number): [number, number] {
  const l = d.clone().applyAxisAngle(THREE.Object3D.DEFAULT_UP, -yaw);
  return [Math.round(l.x), Math.round(l.z)];
}

/** The visible slot whose axis runs towards the bottom-right of the screen. */
function frontSlot(): 'u' | 'v' {
  const [du] = toLocal(SCREEN_DIRS.dr, view.yawTarget);
  return du !== 0 ? 'u' : 'v';
}

function act(a: Action): void {
  if (a.type === 'reset') {
    queued = null;
    game.reset();
    return;
  }
  if (view.busy()) {
    queued = a;
    return;
  }
  switch (a.type) {
    case 'move': {
      const [du, dv] = toLocal(SCREEN_DIRS[a.dir], view.yawTarget);
      game.move(du, dv);
      break;
    }
    case 'yaw':
      view.rotateYaw(a.dir);
      break;
    case 'swap':
      game.swap(frontSlot());
      break;
  }
}

const KEYS: Record<string, Action> = {
  KeyW: { type: 'move', dir: 'ur' },
  ArrowUp: { type: 'move', dir: 'ur' },
  KeyD: { type: 'move', dir: 'dr' },
  ArrowRight: { type: 'move', dir: 'dr' },
  KeyS: { type: 'move', dir: 'dl' },
  ArrowDown: { type: 'move', dir: 'dl' },
  KeyA: { type: 'move', dir: 'ul' },
  ArrowLeft: { type: 'move', dir: 'ul' },
  KeyQ: { type: 'yaw', dir: -1 },
  KeyE: { type: 'yaw', dir: 1 },
  Space: { type: 'swap' },
  KeyR: { type: 'reset' },
};
window.addEventListener('keydown', (e) => {
  if (e.code === 'Enter' && game.won) return act({ type: 'reset' });
  const a = KEYS[e.code];
  if (!a || e.repeat) return;
  e.preventDefault();
  act(a);
});

// --- game events -------------------------------------------------------------
let clock = 0;
game.on((e) => {
  view.handle(e, game.basis, game.pos);
  if (e.type === 'bump') {
    const target: [number, number, number] = [game.pos[0] + e.dir[0], game.pos[1] + e.dir[1], game.pos[2] + e.dir[2]];
    if (level.world.get(target) === Cell.Wall) wallBumps++;
  }
  if (e.type === 'swap') swaps++;
  if (e.type === 'win') {
    board.winT = clock;
    setTimeout(() => {
      const p = board.goalScene.clone().applyMatrix4(board.group.matrixWorld);
      confetti.burst(p);
    }, 250);
    setTimeout(() => hud.showWin(game.moves), 900);
    setHint('none', null);
  }
  if (e.type === 'reset') {
    board.winT = -1;
    hud.showWin(null);
    wallBumps = swaps = 0;
    startTime = performance.now();
    setHint('none', null);
  }
});

// --- frame loop --------------------------------------------------------------
let last = performance.now();
let skyShift = 0;
const origin = new THREE.Vector3();
const tmp = new THREE.Vector3();

function screenDir(local: THREE.Vector3): [number, number] {
  tmp.copy(local).applyAxisAngle(THREE.Object3D.DEFAULT_UP, view.yaw);
  origin.set(0, 0, 0).project(stage.camera);
  tmp.project(stage.camera).sub(origin);
  const len = Math.hypot(tmp.x, tmp.y);
  if (!Number.isFinite(len) || len === 0) return [0, 0];
  return [+(tmp.x / len).toFixed(2), +(-tmp.y / len).toFixed(2)];
}

function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock += dt;

  view.update(dt);
  if (!view.busy() && queued) {
    const a = queued;
    queued = null;
    act(a);
  }

  board.group.rotation.y = view.yaw;
  board.group.updateMatrixWorld();
  board.update(view, clock);
  player.update(view, board.project(view.player, view), clock, dt, game.won);
  clouds.update(clock);
  confetti.update(dt);
  sparkles.material.uniforms.uTime.value = clock;

  const pulse = view.swapPulse();
  stage.setShift(pulse);
  stage.zoom = 1 - 0.035 * pulse;
  stage.updateProjection();
  const hiddenAxis = axisOf(game.basis.h);
  const targetShift = game.hiddenValue() * 0.5 + (hiddenAxis === 2 ? 0 : 0.9);
  skyShift += (targetShift - skyShift) * Math.min(1, dt * 3);
  sky.material.uniforms.uShift.value = skyShift;
  sky.material.uniforms.uPulse.value = pulse;
  sky.material.uniforms.uTime.value = clock;
  sky.material.uniforms.uAspect.value = window.innerWidth / window.innerHeight;

  const front = frontSlot();
  hud.update({
    visible: [axisOf(game.basis.u), axisOf(game.basis.v)],
    front: front === 'u' ? 0 : 1,
    hidden: hiddenAxis,
    hiddenValue: game.hiddenValue(),
    hiddenSize: level.world.size[hiddenAxis],
    moves: game.moves,
    dirs: [screenDir(new THREE.Vector3(1, 0, 0)), screenDir(new THREE.Vector3(0, 0, 1))],
  });

  // contextual hints
  if (!game.won) {
    const idle = (performance.now() - startTime) / 1000;
    if (swaps === 0 && (wallBumps >= 2 || idle > 14)) {
      setHint('swap', 'Ten mur nie ma końca… ale tylko w <b>trzech</b> wymiarach.<br>Naciśnij <b>Spację</b>, żeby obrócić świat w czwarty.');
    } else if (swaps === 1 && game.pos[2] === 0) {
      setHint('step', 'Oś ↘ pokazuje teraz <b>W</b>. Zrób krok w bok, a potem obróć wymiar z powrotem.');
    } else if (swaps >= 1 && game.pos[2] !== 0 && axisOf(game.basis.u) === 0) {
      setHint('free', 'W tym przekroju muru nie ma. Duch muru pokazuje, gdzie stoi „obok”.');
    } else if (hintShown !== 'none' && hintShown !== 'swap' && swaps >= 3) {
      setHint('none', null);
    }
  }

  stage.render(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// handy for debugging from the console
Object.assign(window, { game, view, stage });
