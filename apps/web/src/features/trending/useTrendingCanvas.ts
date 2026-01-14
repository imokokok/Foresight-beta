import { useEffect, useRef, useState, useCallback } from "react";
import {
  BaseParticle,
  COLORS,
  CELL_SIZE,
  LINK_DISTANCE,
  applyMouseInfluence,
  updateParticleGrid,
} from "@/lib/sharedParticleSystem";

export const useTrendingCanvas = (
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  canvasWorkerRef: React.MutableRefObject<Worker | null>,
  offscreenActiveRef: React.MutableRefObject<boolean>
) => {
  const [canvasReady, setCanvasReady] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const isScrollingRef = useRef(false);
  const scrollStopTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      isScrollingRef.current = true;
      if (scrollStopTimerRef.current) {
        clearTimeout(scrollStopTimerRef.current);
      }
      scrollStopTimerRef.current = window.setTimeout(() => {
        isScrollingRef.current = false;
        canvasWorkerRef.current?.postMessage({
          type: "scrolling",
          isScrolling: false,
        });
      }, 120);

      canvasWorkerRef.current?.postMessage({
        type: "scrolling",
        isScrolling: true,
      });

      const viewportHeight = window.innerHeight || 0;
      const threshold = Math.max(viewportHeight * 1.2, 480);
      const shouldShow = window.scrollY > threshold;
      setShowBackToTop((prev) => (prev === shouldShow ? prev : shouldShow));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollStopTimerRef.current) clearTimeout(scrollStopTimerRef.current);
    };
  }, [canvasWorkerRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasEl: HTMLCanvasElement = canvas;
    const supportsOffscreen =
      typeof (canvasEl as any).transferControlToOffscreen === "function" &&
      typeof Worker !== "undefined";
    if (supportsOffscreen) {
      let worker: Worker | null = null;
      try {
        worker = new Worker(new URL("../../workers/particles.worker.ts", import.meta.url), {
          type: "module",
        });
      } catch (err) {
        console.warn("Worker 初始化失败，回退到主线程绘制:", err);
      }
      if (worker) {
        canvasWorkerRef.current = worker;
        try {
          worker.addEventListener("message", (ev: MessageEvent<any>) => {
            const data = (ev as any)?.data;
            if (data && data.type === "ready") {
              setCanvasReady(true);
            }
          });
        } catch {}
        let offscreen: OffscreenCanvas | null = null;
        try {
          offscreen = (canvasEl as any).transferControlToOffscreen();
        } catch (err) {
          console.warn("transferControlToOffscreen 失败，回退到主线程绘制:", err);
        }
        if (offscreen) {
          const init = () => {
            const dpr = window.devicePixelRatio || 1;
            worker!.postMessage(
              {
                type: "init",
                canvas: offscreen!,
                width: window.innerWidth,
                height: window.innerHeight,
                dpr,
              },
              [offscreen!]
            );
          };
          init();
          const onResize = () => {
            const dpr = window.devicePixelRatio || 1;
            worker!.postMessage({
              type: "resize",
              width: window.innerWidth,
              height: window.innerHeight,
              dpr,
            });
          };
          let rafPending = false;
          const onMouseMove = (e: MouseEvent) => {
            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(() => {
              const rect = canvasEl.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              worker!.postMessage({ type: "mouse", x, y, active: true });
              rafPending = false;
            });
          };
          const onMouseLeave = () => {
            worker!.postMessage({ type: "mouse", x: 0, y: 0, active: false });
          };
          window.addEventListener("resize", onResize);
          window.addEventListener("mousemove", onMouseMove);
          window.addEventListener("mouseleave", onMouseLeave);
          worker!.postMessage({ type: "scrolling", isScrolling: false });
          offscreenActiveRef.current = true;
          return () => {
            window.removeEventListener("resize", onResize);
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseleave", onMouseLeave);
            try {
              worker!.postMessage({ type: "destroy" });
            } catch {}
            worker!.terminate();
            canvasWorkerRef.current = null;
            offscreenActiveRef.current = false;
          };
        }
      }
    }
    if (offscreenActiveRef.current) return;
    let context: CanvasRenderingContext2D | null = null;
    try {
      context = canvasEl.getContext("2d");
    } catch (err) {
      console.warn("主线程 fallback 获取 2D 上下文失败（可能已 Offscreen 接管）:", err);
      return;
    }
    if (!context) return;
    const ctx = context;
    let animId = 0;

    class Particle extends BaseParticle {
      constructor() {
        super(canvasEl.width, canvasEl.height);
      }

      update() {
        super.update(canvasEl.width, canvasEl.height);
      }

      draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.fillStyle = this.color;
        ctx.strokeStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 8;
        super.draw(ctx);
        ctx.restore();
      }
    }

    const particles: Particle[] = [];
    const grid: Map<string, number[]> = new Map();

    const getNearbyParticleIndices = (p: Particle) => {
      const cellX = Math.floor(p.x / CELL_SIZE);
      const cellY = Math.floor(p.y / CELL_SIZE);
      const result: number[] = [];
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          const key = `${cellX + dx},${cellY + dy}`;
          const arr = grid.get(key);
          if (arr) result.push(...arr);
        }
      }
      return result;
    };

    const drawBackgroundGrid = () => {
      ctx.save();
      ctx.strokeStyle = "rgba(148, 163, 184, 0.14)";
      ctx.lineWidth = 1;
      const step = CELL_SIZE * 1.2;
      const offsetX = -((window.scrollY * 0.12) % step);
      const offsetY = -((window.scrollY * 0.08) % step);
      for (let x = offsetX; x < canvasEl.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasEl.height);
        ctx.stroke();
      }
      for (let y = offsetY; y < canvasEl.height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasEl.width, y);
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawConnections = () => {
      ctx.save();
      ctx.lineWidth = 0.6;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const neighbors = getNearbyParticleIndices(p);
        for (const j of neighbors) {
          if (j <= i) continue;
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= LINK_DISTANCE) {
            const alpha = 0.35 * (1 - dist / LINK_DISTANCE);
            ctx.strokeStyle = `rgba(129, 140, 248, ${alpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    };

    const initParticles = () => {
      particles.length = 0;
      const area = (canvasEl.width * canvasEl.height) / 5000;
      const count = Math.min(160, Math.max(40, Math.floor(area)));
      for (let i = 0; i < count; i++) {
        particles.push(new Particle());
      }
      // 使用共享的网格更新函数
      const newGrid = updateParticleGrid(particles, CELL_SIZE);
      grid.clear();
      newGrid.forEach((value, key) => grid.set(key, value));
    };

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      canvasEl.width = window.innerWidth * dpr;
      canvasEl.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initParticles();
    };

    resizeCanvas();

    let lastTime = performance.now();
    const draw = () => {
      const now = performance.now();
      const delta = Math.min(32, now - lastTime);
      lastTime = now;

      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

      drawBackgroundGrid();

      // 使用共享的粒子更新方法，确保行为一致性
      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
      }

      // 使用共享的网格更新函数
      const newGrid = updateParticleGrid(particles, CELL_SIZE);
      grid.clear();
      newGrid.forEach((value, key) => grid.set(key, value));

      drawConnections();

      for (let i = 0; i < particles.length; i++) {
        particles[i].draw();
      }

      animId = requestAnimationFrame(draw);
    };

    const handleResize = () => {
      resizeCanvas();
    };

    window.addEventListener("resize", handleResize);

    animId = requestAnimationFrame(draw);

    setCanvasReady(true);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animId);
    };
  }, [canvasRef, canvasWorkerRef, offscreenActiveRef]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return {
    canvasReady,
    showBackToTop,
    scrollToTop,
  };
};
