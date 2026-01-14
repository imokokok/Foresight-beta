/* eslint-disable no-restricted-globals */

import {
  BaseParticle,
  COLORS,
  CELL_SIZE,
  LINK_DISTANCE,
  applyMouseInfluence,
  updateParticleGrid,
} from "@/lib/sharedParticleSystem";

export type InitMsg = {
  type: "init";
  canvas: OffscreenCanvas;
  width: number;
  height: number;
  dpr: number;
};

export type ResizeMsg = {
  type: "resize";
  width: number;
  height: number;
  dpr: number;
};

export type MouseMsg = {
  type: "mouse";
  x: number;
  y: number;
  active: boolean;
};

export type ScrollingMsg = {
  type: "scrolling";
  isScrolling: boolean;
};

export type DestroyMsg = { type: "destroy" };

type WorkerMsg = InitMsg | ResizeMsg | MouseMsg | ScrollingMsg | DestroyMsg;

let ctx: OffscreenCanvasRenderingContext2D | null = null;
let canvas: OffscreenCanvas | null = null;
let canvasWidth = 0;
let canvasHeight = 0;
let dpr = 1;
let animHandle: number | null = null;
let hasSentReady = false;

class Particle extends BaseParticle {
  constructor() {
    super(canvasWidth, canvasHeight);
  }

  update() {
    super.update(canvasWidth, canvasHeight);
  }

  draw(localCtx: OffscreenCanvasRenderingContext2D) {
    super.draw(localCtx);
  }
}

let particles: Particle[] = [];
let mouseX = 0,
  mouseY = 0,
  mouseActive = false;
let isScrolling = false;

function startLoop() {
  if (!ctx || !canvas) return;
  if (animHandle) return;
  const loop = () => {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    particles.forEach((p) => p.update());

    // 应用鼠标影响
    applyMouseInfluence(particles, mouseX, mouseY, mouseActive);

    if (!isScrolling) {
      // 更新粒子网格
      const grid = updateParticleGrid(particles, CELL_SIZE);

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
                const alpha = Math.max(0.05, ((LINK_DISTANCE - dist) / LINK_DISTANCE) * 0.4);
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.strokeStyle = "#c4b5fd";
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
                p.x -= nx * sep;
                p.y -= ny * sep;
                q.x += nx * sep;
                q.y += ny * sep;
                const pNorm = p.speedX * nx + p.speedY * ny;
                const qNorm = q.speedX * nx + q.speedY * ny;
                const diff = qNorm - pNorm;
                p.speedX += diff * nx;
                p.speedY += diff * ny;
                q.speedX -= diff * nx;
                q.speedY -= diff * ny;
                p.speedX *= 0.98;
                p.speedY *= 0.98;
                q.speedX *= 0.98;
                q.speedY *= 0.98;
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
      try {
        (self as unknown as Worker).postMessage({ type: "ready" });
      } catch {}
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
    case "init": {
      canvas = data.canvas;
      ctx = canvas.getContext("2d");
      resizeCanvas(data.width, data.height, data.dpr);
      setupParticles();
      startLoop();
      break;
    }
    case "resize": {
      resizeCanvas(data.width, data.height, data.dpr);
      break;
    }
    case "mouse": {
      mouseX = data.x;
      mouseY = data.y;
      mouseActive = data.active;
      break;
    }
    case "scrolling": {
      isScrolling = !!data.isScrolling;
      break;
    }
    case "destroy": {
      if (animHandle) {
        clearTimeout(animHandle);
        animHandle = null;
      }
      particles = [];
      ctx = null;
      canvas = null;
      hasSentReady = false;
      break;
    }
  }
};

export default null;
