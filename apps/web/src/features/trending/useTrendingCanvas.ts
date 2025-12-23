import { useEffect, useRef, useState, useCallback } from "react";

export const useTrendingCanvas = (
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  canvasWorkerRef: React.MutableRefObject<Worker | null>,
  offscreenActiveRef: React.MutableRefObject<boolean>
) => {
  const [canvasReady, setCanvasReady] = useState(false);
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

    type Shape =
      | "circle"
      | "square"
      | "triangle"
      | "diamond"
      | "ring"
      | "pentagon"
      | "hexagon"
      | "octagon";
    const COLORS = [
      "rgba(255, 140, 180, 0.48)",
      "rgba(179, 136, 255, 0.45)",
      "rgba(100, 200, 255, 0.42)",
      "rgba(120, 230, 190, 0.44)",
      "rgba(255, 190, 120, 0.4)",
    ];

    const LINK_DISTANCE = 90;
    const CELL_SIZE = 24;

    class Particle {
      x: number;
      y: number;
      baseSize: number;
      size: number;
      speedX: number;
      speedY: number;
      rotation: number;
      rotationSpeed: number;
      shape: Shape;
      color: string;
      radius: number;
      pulsePhase: number;
      constructor() {
        this.x = Math.random() * canvasEl.width;
        this.y = Math.random() * canvasEl.height;
        this.baseSize = 6 + Math.random() * 0.8;
        this.size = this.baseSize;
        this.speedX = Math.random() * 0.6 - 0.3;
        this.speedY = Math.random() * 0.6 - 0.3;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = Math.random() * 0.01 - 0.005;
        const shapesPool: Shape[] = [
          "circle",
          "square",
          "diamond",
          "ring",
          "pentagon",
          "hexagon",
          "octagon",
          "circle",
          "square",
          "diamond",
          "ring",
          "pentagon",
          "hexagon",
          "circle",
          "square",
          "diamond",
          "triangle",
        ];
        this.shape = shapesPool[Math.floor(Math.random() * shapesPool.length)];
        this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
        this.pulsePhase = Math.random() * Math.PI * 2;
        switch (this.shape) {
          case "circle":
            this.radius = this.baseSize;
            break;
          case "square": {
            const s = this.baseSize * 1.6;
            this.radius = (s * Math.SQRT2) / 2;
            break;
          }
          case "triangle": {
            const s = this.baseSize * 2;
            this.radius = s / 2;
            break;
          }
          case "diamond": {
            const s = this.baseSize * 2;
            this.radius = s / 2;
            break;
          }
          case "ring":
            this.radius = this.baseSize * 1.4;
            break;
          case "pentagon":
          case "hexagon":
          case "octagon":
            this.radius = this.baseSize * 1.8;
            break;
        }
      }
      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.rotation += this.rotationSpeed;
        this.size = this.baseSize * (1 + 0.03 * Math.sin(this.pulsePhase));
        this.pulsePhase += 0.015;
        if (this.x < 0 || this.x > canvasEl.width) this.speedX *= -1;
        if (this.y < 0 || this.y > canvasEl.height) this.speedY *= -1;
      }
      draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.fillStyle = this.color;
        ctx.strokeStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 8;
        switch (this.shape) {
          case "circle": {
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          case "square": {
            const s = this.size * 1.6;
            ctx.beginPath();
            ctx.rect(-s / 2, -s / 2, s, s);
            ctx.fill();
            break;
          }
          case "triangle": {
            const s = this.size * 2;
            ctx.beginPath();
            ctx.moveTo(0, -s / 2);
            ctx.lineTo(s / 2, s / 2);
            ctx.lineTo(-s / 2, s / 2);
            ctx.closePath();
            ctx.fill();
            break;
          }
          case "diamond": {
            const s = this.size * 2;
            ctx.beginPath();
            ctx.moveTo(0, -s / 2);
            ctx.lineTo(s / 2, 0);
            ctx.lineTo(0, s / 2);
            ctx.lineTo(-s / 2, 0);
            ctx.closePath();
            ctx.fill();
            break;
          }
          case "ring": {
            const outer = this.size * 1.4;
            const inner = this.size * 0.9;
            ctx.beginPath();
            ctx.arc(0, 0, outer, 0, Math.PI * 2);
            ctx.arc(0, 0, inner, 0, Math.PI * 2, true);
            ctx.fill();
            break;
          }
          case "pentagon":
          case "hexagon":
          case "octagon": {
            const sides = this.shape === "pentagon" ? 5 : this.shape === "hexagon" ? 6 : 8;
            const radius = this.size * 1.8;
            ctx.beginPath();
            for (let i = 0; i < sides; i++) {
              const angle = (i / sides) * Math.PI * 2;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            break;
          }
        }
        ctx.restore();
      }
    }

    const particles: Particle[] = [];
    const grid: Map<string, number[]> = new Map();

    const updateGrid = () => {
      grid.clear();
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const cellX = Math.floor(p.x / CELL_SIZE);
        const cellY = Math.floor(p.y / CELL_SIZE);
        const key = `${cellX},${cellY}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key)!.push(i);
      }
    };

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
      updateGrid();
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

      const speedFactor = isScrollingRef.current ? 1.5 : 1;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.speedX * speedFactor * (delta / 16);
        p.y += p.speedY * speedFactor * (delta / 16);
        p.rotation += p.rotationSpeed * (delta / 16);
        p.size = p.baseSize * (1 + 0.03 * Math.sin(p.pulsePhase));
        p.pulsePhase += 0.015 * (delta / 16);

        if (p.x < -p.radius) p.x = canvasEl.width + p.radius;
        if (p.x > canvasEl.width + p.radius) p.x = -p.radius;
        if (p.y < -p.radius) p.y = canvasEl.height + p.radius;
        if (p.y > canvasEl.height + p.radius) p.y = -p.radius;
      }

      updateGrid();

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

  const showBackToTop = true;

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return {
    canvasReady,
    showBackToTop,
    scrollToTop,
  };
};
