import { AXIS_NAMES } from '../world/world';

export type Action =
  | { type: 'move'; dir: 'ur' | 'dr' | 'dl' | 'ul' }
  | { type: 'yaw'; dir: 1 | -1 }
  | { type: 'swap' }
  | { type: 'reset' };

export interface HudState {
  visible: [number, number];
  front: 0 | 1;
  hidden: number;
  hiddenValue: number;
  hiddenSize: number;
  moves: number;
  /** Screen-space unit directions of the two visible axes (SVG coordinates, y down). */
  dirs: [[number, number], [number, number]];
}

const AXIS_COLORS = ['#ff7a6b', '#5fb8ff', '#c38bff'];

/** HTML overlay: axis gizmo, buttons, hints, intro and win cards. */
export class Hud {
  private readonly root: HTMLElement;
  private readonly gizmo: SVGSVGElement;
  private readonly axisText: HTMLElement;
  private readonly slices: HTMLElement;
  private readonly moves: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly win: HTMLElement;
  private readonly swapLabel: HTMLElement;
  private lastKey = '';

  constructor(root: HTMLElement, title: string, subtitle: string, onAction: (a: Action) => void) {
    this.root = root;
    root.innerHTML = /* html */ `
      <div class="panel axes">
        <svg class="gizmo" viewBox="-60 -60 120 120"></svg>
        <div>
          <div class="axis-text"></div>
          <div class="slices"></div>
        </div>
      </div>
      <div class="panel top-right">
        <span class="moves">0</span><span class="moves-label">ruchów</span>
        <button class="icon" data-a="reset" title="Restart (R)">↺</button>
      </div>
      <div class="intro">
        <div class="brand">Fourthcoming</div>
        <h1>${title}</h1>
        <p>${subtitle}</p>
      </div>
      <div class="hint"></div>
      <div class="controls">
        <button class="round" data-a="yaw-1" title="Obróć planszę (Q)">⟲</button>
        <button class="swap" data-a="swap" title="Obrót wymiaru (Spacja)">
          <span class="swap-icon">✦</span><span class="swap-label"></span><kbd>Spacja</kbd>
        </button>
        <button class="round" data-a="yaw1" title="Obróć planszę (E)">⟳</button>
      </div>
      <div class="dpad">
        <button data-a="ul" title="A / ←">↖</button>
        <button data-a="ur" title="W / ↑">↗</button>
        <button data-a="dl" title="S / ↓">↙</button>
        <button data-a="dr" title="D / →">↘</button>
      </div>
      <div class="win hidden">
        <div class="win-card">
          <div class="brand">Fourthcoming</div>
          <h2>Jesteś po drugiej stronie!</h2>
          <p class="win-moves"></p>
          <p class="win-note">Mur był nieskończony tylko w trzech wymiarach.</p>
          <button data-a="reset" class="primary">Jeszcze raz</button>
        </div>
      </div>
    `;
    this.gizmo = root.querySelector('.gizmo')!;
    this.axisText = root.querySelector('.axis-text')!;
    this.slices = root.querySelector('.slices')!;
    this.moves = root.querySelector('.moves')!;
    this.hint = root.querySelector('.hint')!;
    this.win = root.querySelector('.win')!;
    this.swapLabel = root.querySelector('.swap-label')!;

    root.addEventListener('click', (ev) => {
      const b = (ev.target as HTMLElement).closest('button');
      if (!b) return;
      b.blur();
      const a = b.dataset.a!;
      if (a === 'reset') onAction({ type: 'reset' });
      else if (a === 'swap') onAction({ type: 'swap' });
      else if (a === 'yaw1') onAction({ type: 'yaw', dir: 1 });
      else if (a === 'yaw-1') onAction({ type: 'yaw', dir: -1 });
      else onAction({ type: 'move', dir: a as 'ur' });
    });
    setTimeout(() => root.querySelector('.intro')?.classList.add('gone'), 3800);
  }

  update(s: HudState): void {
    const key = JSON.stringify(s);
    if (key === this.lastKey) return;
    this.lastKey = key;

    const name = (a: number) => `<b style="color:${AXIS_COLORS[a]}">${AXIS_NAMES[a]}</b>`;
    this.axisText.innerHTML =
      `Widzisz ${name(s.visible[0])} · ${name(s.visible[1])}<br>` +
      `<span class="muted">ukryta oś</span> ${name(s.hidden)} = ${s.hiddenValue}`;
    this.slices.innerHTML = Array.from({ length: s.hiddenSize }, (_, i) =>
      `<i class="${i === s.hiddenValue ? 'on' : ''}" style="--c:${AXIS_COLORS[s.hidden]}"></i>`,
    ).join('');
    this.moves.textContent = String(s.moves);
    const frontAxis = s.visible[s.front];
    this.swapLabel.innerHTML = `${name(frontAxis)} ⇄ ${name(s.hidden)}`;

    const arrows = s.dirs
      .map(([dx, dy], i) => {
        const a = s.visible[i];
        const c = AXIS_COLORS[a];
        const front = i === s.front;
        const x = dx * 38, y = dy * 38;
        return `
          <line x1="${-x}" y1="${-y}" x2="${x}" y2="${y}" stroke="${c}" stroke-width="${front ? 6 : 4}"
                stroke-linecap="round" opacity="${front ? 1 : 0.75}"/>
          <circle cx="${x}" cy="${y}" r="${front ? 12 : 10}" fill="${c}"/>
          <text x="${x}" y="${y + 4.5}" text-anchor="middle" class="glabel">${AXIS_NAMES[a]}</text>
          ${front ? `<circle cx="${x}" cy="${y}" r="17" fill="none" stroke="${c}" stroke-width="2" class="pulse"/>` : ''}`;
      })
      .join('');
    this.gizmo.innerHTML = `<circle r="5" fill="#fff"/>${arrows}`;
  }

  showHint(html: string | null): void {
    if (html) {
      this.hint.innerHTML = html;
      this.hint.classList.add('show');
    } else {
      this.hint.classList.remove('show');
    }
  }

  showWin(moves: number | null): void {
    this.win.classList.toggle('hidden', moves === null);
    if (moves !== null) this.root.querySelector('.win-moves')!.textContent = `Liczba ruchów: ${moves}`;
  }
}
