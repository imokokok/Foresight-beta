/* eslint-disable no-restricted-globals */

export type InitMsg = {
  type: 'init';
  canvas: OffscreenCanvas;
  width: number;
  height: number;
  dpr: number;
};

export type ResizeMsg = {
  type: 'resize';
  width: number;
  height: number;
  dpr: number;
};

export type MouseMsg = {
  type: 'mouse';
  x: number;
  y: number;
  active: boolean;
};

export type ScrollingMsg = {
  type: 'scrolling';
  isScrolling: boolean;
};

export type DestroyMsg = { type: 'destroy' };

type WorkerMsg = InitMsg | ResizeMsg | MouseMsg | ScrollingMsg | DestroyMsg;

let ctx: OffscreenCanvasRenderingContext2D | null = null;
let canvas: OffscreenCanvas | null = null;
let canvasWidth = 0;
let canvasHeight = 0;
let dpr = 1;
let animHandle: number | null = null;
let hasSentReady = false;

type Shape = 'circle' | 'square' | 'triangle' | 'diamond' | 'ring' | 'pentagon' | 'hexagon' | 'octagon';
const COLORS = [
  'rgba(255, 140, 180, 0.48)',
  'rgba(179, 136, 255, 0.45)',
  'rgba(100, 200, 255, 0.42)',
  'rgba(120, 230, 190, 0.44)',
  'rgba(255, 190, 120, 0.40)',
];
const LINK_DISTANCE = 90;
const CELL_SIZE = 24;

class Particle {
  x: number = 0;
  y: number = 0;
  baseSize: number = 0;
  size: number = 0;
  speedX: number = 0;
  speedY: number = 0;
  rotation: number = 0;
  rotationSpeed: number = 0;
  shape: Shape = 'circle';
  color: string = COLORS[0];
  radius: number = 0;
  pulsePhase: number = 0;
  constructor() {
    this.x = Math.random() * canvasWidth;
    this.y = Math.random() * canvasHeight;
    this.baseSize = 6 + Math.random() * 0.8;
    this.size = this.baseSize;
    this.speedX = Math.random() * 0.6 - 0.3;
    this.speedY = Math.random() * 0.6 - 0.3;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() * 0.01) - 0.005;
    const shapesPool: Shape[] = ['circle','square','diamond','ring','pentagon','hexagon','octagon','circle','square','diamond','ring','pentagon','hexagon','circle','square','diamond','triangle'];
    this.shape = shapesPool[Math.floor(Math.random() * shapesPool.length)];
    this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    this.pulsePhase = Math.random() * Math.PI * 2;
    switch (this.shape) {
      case 'circle': this.radius = this.baseSize; break;
      case 'square': { const s = this.baseSize * 1.6; this.radius = (s * Math.SQRT2) / 2; break; }
      case 'triangle': { const s = this.baseSize * 2; this.radius = s / 2; break; }
      case 'diamond': { const s = this.baseSize * 2; this.radius = s / 2; break; }
      case 'ring': this.radius = this.baseSize * 1.4; break;
      case 'pentagon': this.radius = this.baseSize * 1.6; break;
      case 'hexagon': this.radius = this.baseSize * 1.8; break;
      case 'octagon': this.radius = this.baseSize * 2.0; break;
    }
  }
  update() {
    const pulseSpeed = 0.015;
    this.pulsePhase += pulseSpeed;
    const pulse = 0.15 * Math.sin(this.pulsePhase);
    this.size = this.baseSize * (1 + pulse);
    this.rotation += this.rotationSpeed;
    this.x += this.speedX;
    this.y += this.speedY;
    if (this.x < 0 || this.x > canvasWidth) this.speedX *= -1;
    if (this.y < 0 || this.y > canvasHeight) this.speedY *= -1;
  }
  draw(localCtx: OffscreenCanvasRenderingContext2D) {
    localCtx.save();
    localCtx.translate(this.x, this.y);
    localCtx.rotate(this.rotation);
    localCtx.fillStyle = this.color;
    switch (this.shape) {
      case 'circle':
        localCtx.beginPath();
        localCtx.arc(0, 0, this.size, 0, Math.PI * 2);
        localCtx.fill();
        break;
      case 'square': {
        const s = this.size * 1.6;
        localCtx.fillRect(-s / 2, -s / 2, s, s);
        break;
      }
      case 'triangle': {
        const s = this.size * 2;
        localCtx.beginPath();
        localCtx.moveTo(0, -s / 2);
        localCtx.lineTo(-s / 2, s / 2);
        localCtx.lineTo(s / 2, s / 2);
        localCtx.closePath();
        localCtx.fill();
        break;
      }
      case 'diamond': {
        const s = this.size * 2;
        localCtx.beginPath();
        localCtx.moveTo(0, -s / 2);
        localCtx.lineTo(-s / 2, 0);
        localCtx.lineTo(0, s / 2);
        localCtx.lineTo(s / 2, 0);
        localCtx.closePath();
        localCtx.fill();
        break;
      }
      case 'ring': {
        const outer = this.size * 1.4;
        const inner = this.size * 0.85;
        localCtx.beginPath();
        localCtx.arc(0, 0, outer, 0, Math.PI * 2);
        localCtx.arc(0, 0, inner, 0, Math.PI * 2, true);
        localCtx.closePath();
        localCtx.fill();
        break;
      }
      case 'pentagon': {
        const r = this.size * 1.6;
        localCtx.beginPath();
        for (let k = 0; k < 5; k++) {
          const ang = (Math.PI * 2 * k) / 5 - Math.PI / 2;
          const px = Math.cos(ang) * r;
          const py = Math.sin(ang) * r;
          if (k === 0) localCtx.moveTo(px, py); else localCtx.lineTo(px, py);
        }
        localCtx.closePath();
        localCtx.fill();
        break;
      }
      case 'hexagon': {
        const r = this.size * 1.7;
        localCtx.beginPath();
        for (let k = 0; k < 6; k++) {
          const ang = (Math.PI * 2 * k) / 6 - Math.PI / 2;
          const px = Math.cos(ang) * r;
          const py = Math.sin(ang) * r;
          if (k === 0) localCtx.moveTo(px, py); else localCtx.lineTo(px, py);
        }
        localCtx.closePath();
        localCtx.fill();
        break;
      }
      case 'octagon': {
        const r = this.size * 1.8;
        localCtx.beginPath();
        for (let k = 0; k < 8; k++) {
          const ang = (Math.PI * 2 * k) / 8 - Math.PI / 2;
          const px = Math.cos(ang) * r;
          const py = Math.sin(ang) * r;
          if (k === 0) localCtx.moveTo(px, py); else localCtx.lineTo(px, py);
        }
        localCtx.closePath();
        localCtx.fill();
        break;
      }
    }
    localCtx.restore();
  }
}

let particles: Particle[] = [];
let mouseX = 0, mouseY = 0, mouseActive = false;
let isScrolling = false;

function startLoop() {
  if (!ctx || !canvas) return;
  if (animHandle) return;
  const loop = () => {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    particles.forEach((p) => p.update());

    if (mouseActive) {
      const influenceR = 150;
      const forceBase = 0.12;
      const maxSpeed = 1.4;
      for (const p of particles) {
        const dx = p.x - mouseX;
        const dy = p.y - mouseY;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < influenceR) {
          const strength = 1 - (dist / influenceR);
          const accel = forceBase * strength;
          const nx = dx / dist;
          const ny = dy / dist;
          p.speedX += nx * accel;
          p.speedY += ny * accel;
          const v = Math.hypot(p.speedX, p.speedY);
          if (v > maxSpeed) {
            p.speedX = (p.speedX / v) * maxSpeed;
            p.speedY = (p.speedY / v) * maxSpeed;
          }
        }
      }
    }

    if (!isScrolling) {
      const grid = new Map<string, number[]>();
      const keyOf = (x: number, y: number) => `${Math.floor(x / CELL_SIZE)},${Math.floor(y / CELL_SIZE)}`;
      particles.forEach((p, i) => {
        const key = keyOf(p.x, p.y);
        const cell = grid.get(key);
        if (cell) cell.push(i); else grid.set(key, [i]);
      });
      const neighborsOffsets = [-1, 0, 1];
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const cx = Math.floor(p.x / CELL_SIZE);
        const cy = Math.floor(p.y / CELL_SIZE);
        for (const ox of neighborsOffsets) {
          for (const oy of neighborsOffsets) {
            const key = `${cx + ox},${cy + oy}`;
            const bucket = grid.get(key);
            if (!bucket) continue;
            for (const j of bucket) {
              if (j <= i) continue;
              const q = particles[j];
              const dx = q.x - p.x;
              const dy = q.y - p.y;
              const dist = Math.hypot(dx, dy);
              if (dist < LINK_DISTANCE) {
                const alpha = Math.max(0.05, (LINK_DISTANCE - dist) / LINK_DISTANCE * 0.40);
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.strokeStyle = '#c4b5fd';
                ctx.lineWidth = 0.7;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(q.x, q.y);
                ctx.stroke();
                ctx.restore();
              }
              const rSum = p.radius + q.radius;
              if (dist > 0 && dist < rSum) {
                const overlap = rSum - dist;
                const nx = dx / dist;
                const ny = dy / dist;
                const sep = overlap * 0.5;
                p.x -= nx * sep; p.y -= ny * sep;
                q.x += nx * sep; q.y += ny * sep;
                const pNorm = p.speedX * nx + p.speedY * ny;
                const qNorm = q.speedX * nx + q.speedY * ny;
                const diff = qNorm - pNorm;
                p.speedX += diff * nx; p.speedY += diff * ny;
                q.speedX -= diff * nx; q.speedY -= diff * ny;
                p.speedX *= 0.98; p.speedY *= 0.98;
                q.speedX *= 0.98; q.speedY *= 0.98;
              }
            }
          }
        }
      }
    }

    particles.forEach((p) => p.draw(ctx!));
    // 首帧绘制完成后通知主线程可以淡入
    if (!hasSentReady) {
      hasSentReady = true;
      try { (self as unknown as Worker).postMessage({ type: 'ready' }); } catch {}
    }
    animHandle = setTimeout(loop, 16) as unknown as number;
  };
  loop();
}

function setupParticles() {
  particles = [];
  const baseCount = 60;
  const scaleFactor = Math.min(2, (canvasWidth * canvasHeight) / (1280 * 720));
  const particleCount = Math.floor(baseCount * scaleFactor);
  for (let i = 0; i < particleCount; i++) particles.push(new Particle());
}

function resizeCanvas(w: number, h: number, deviceScale: number) {
  canvasWidth = Math.max(0, Math.floor(w));
  canvasHeight = Math.max(0, Math.floor(h));
  dpr = Math.max(1, deviceScale || 1);
  if (!canvas || !ctx) return;
  canvas.width = Math.floor(canvasWidth * dpr);
  canvas.height = Math.floor(canvasHeight * dpr);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
}

self.onmessage = (ev: MessageEvent<WorkerMsg>) => {
  const data = ev.data;
  switch (data.type) {
    case 'init': {
      canvas = data.canvas;
      ctx = canvas.getContext('2d');
      resizeCanvas(data.width, data.height, data.dpr);
      setupParticles();
      startLoop();
      break;
    }
    case 'resize': {
      resizeCanvas(data.width, data.height, data.dpr);
      break;
    }
    case 'mouse': {
      mouseX = data.x; mouseY = data.y; mouseActive = data.active;
      break;
    }
    case 'scrolling': {
      isScrolling = !!data.isScrolling;
      break;
    }
    case 'destroy': {
      if (animHandle) { clearTimeout(animHandle); animHandle = null; }
      particles = [];
      ctx = null; canvas = null;
      hasSentReady = false;
      break;
    }
  }
};

export default null;