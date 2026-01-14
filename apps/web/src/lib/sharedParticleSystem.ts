// 形状枚举，提高类型安全性和可读性
export enum Shape {
  CIRCLE = "circle",
  SQUARE = "square",
  TRIANGLE = "triangle",
  DIAMOND = "diamond",
  RING = "ring",
  PENTAGON = "pentagon",
  HEXAGON = "hexagon",
  OCTAGON = "octagon",
}

// 粒子系统配置
const PARTICLE_CONFIG = {
  COLORS: [
    "rgba(255, 140, 180, 0.48)",
    "rgba(179, 136, 255, 0.45)",
    "rgba(100, 200, 255, 0.42)",
    "rgba(120, 230, 190, 0.44)",
    "rgba(255, 190, 120, 0.40)",
  ],
  LINK_DISTANCE: 90,
  CELL_SIZE: 24,
  MAX_SPEED: 1.4,
  MOUSE_INFLUENCE_RADIUS: 150,
  MOUSE_FORCE_BASE: 0.12,
  PULSE_SPEED: 0.015,
  PULSE_AMPLITUDE: 0.15,
  SHAPES_POOL: [
    Shape.CIRCLE,
    Shape.SQUARE,
    Shape.DIAMOND,
    Shape.RING,
    Shape.PENTAGON,
    Shape.HEXAGON,
    Shape.OCTAGON,
    Shape.CIRCLE,
    Shape.SQUARE,
    Shape.DIAMOND,
    Shape.RING,
    Shape.PENTAGON,
    Shape.HEXAGON,
    Shape.CIRCLE,
    Shape.SQUARE,
    Shape.DIAMOND,
    Shape.TRIANGLE,
  ] as Shape[],
};

// 导出常量，保持向后兼容
export const COLORS = PARTICLE_CONFIG.COLORS;
export const LINK_DISTANCE = PARTICLE_CONFIG.LINK_DISTANCE;
export const CELL_SIZE = PARTICLE_CONFIG.CELL_SIZE;

// 半径计算映射，替代switch语句，提高性能和可读性
const RADIUS_CALCULATORS = {
  [Shape.CIRCLE]: (baseSize: number) => baseSize,
  [Shape.SQUARE]: (baseSize: number) => (baseSize * 1.6 * Math.SQRT2) / 2,
  [Shape.TRIANGLE]: (baseSize: number) => (baseSize * 2) / 2,
  [Shape.DIAMOND]: (baseSize: number) => (baseSize * 2) / 2,
  [Shape.RING]: (baseSize: number) => baseSize * 1.4,
  [Shape.PENTAGON]: (baseSize: number) => baseSize * 1.6,
  [Shape.HEXAGON]: (baseSize: number) => baseSize * 1.7,
  [Shape.OCTAGON]: (baseSize: number) => baseSize * 2.0,
};

// 形状绘制映射，替代switch语句，提高性能和可读性
const SHAPE_DRAWERS = {
  [Shape.CIRCLE]: (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    size: number
  ) => {
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();
  },
  [Shape.SQUARE]: (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    size: number
  ) => {
    const s = size * 1.6;
    ctx.fillRect(-s / 2, -s / 2, s, s);
  },
  [Shape.TRIANGLE]: (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    size: number
  ) => {
    const s = size * 2;
    ctx.beginPath();
    ctx.moveTo(0, -s / 2);
    ctx.lineTo(-s / 2, s / 2);
    ctx.lineTo(s / 2, s / 2);
    ctx.closePath();
    ctx.fill();
  },
  [Shape.DIAMOND]: (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    size: number
  ) => {
    const s = size * 2;
    ctx.beginPath();
    ctx.moveTo(0, -s / 2);
    ctx.lineTo(-s / 2, 0);
    ctx.lineTo(0, s / 2);
    ctx.lineTo(s / 2, 0);
    ctx.closePath();
    ctx.fill();
  },
  [Shape.RING]: (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    size: number
  ) => {
    const outer = size * 1.4;
    const inner = size * 0.85;
    ctx.beginPath();
    ctx.arc(0, 0, outer, 0, Math.PI * 2);
    ctx.arc(0, 0, inner, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();
  },
  [Shape.PENTAGON]: (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    size: number
  ) => {
    const r = size * 1.6;
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const ang = (Math.PI * 2 * k) / 5 - Math.PI / 2;
      const px = Math.cos(ang) * r;
      const py = Math.sin(ang) * r;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  },
  [Shape.HEXAGON]: (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    size: number
  ) => {
    const r = size * 1.7;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const ang = (Math.PI * 2 * k) / 6 - Math.PI / 2;
      const px = Math.cos(ang) * r;
      const py = Math.sin(ang) * r;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  },
  [Shape.OCTAGON]: (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    size: number
  ) => {
    const r = size * 2.0;
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const ang = (Math.PI * 2 * k) / 8 - Math.PI / 2;
      const px = Math.cos(ang) * r;
      const py = Math.sin(ang) * r;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  },
};

/**
 * 粒子基础类，包含粒子的基本属性和行为
 */
export class BaseParticle {
  x: number = 0;
  y: number = 0;
  baseSize: number = 0;
  size: number = 0;
  speedX: number = 0;
  speedY: number = 0;
  rotation: number = 0;
  rotationSpeed: number = 0;
  shape: Shape = Shape.CIRCLE;
  color: string = PARTICLE_CONFIG.COLORS[0];
  radius: number = 0;
  pulsePhase: number = 0;

  /**
   * 构造函数，初始化粒子属性
   * @param canvasWidth 画布宽度
   * @param canvasHeight 画布高度
   */
  constructor(canvasWidth: number, canvasHeight: number) {
    this.init(canvasWidth, canvasHeight);
  }

  /**
   * 初始化粒子属性
   * @param canvasWidth 画布宽度
   * @param canvasHeight 画布高度
   */
  private init(canvasWidth: number, canvasHeight: number): void {
    // 随机生成粒子位置
    this.x = Math.random() * canvasWidth;
    this.y = Math.random() * canvasHeight;

    // 随机生成粒子大小和速度
    this.baseSize = 6 + Math.random() * 0.8;
    this.size = this.baseSize;
    this.speedX = Math.random() * 0.6 - 0.3;
    this.speedY = Math.random() * 0.6 - 0.3;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = Math.random() * 0.01 - 0.005;

    // 随机选择形状和颜色
    const shapeIndex = Math.floor(Math.random() * PARTICLE_CONFIG.SHAPES_POOL.length);
    this.shape = PARTICLE_CONFIG.SHAPES_POOL[shapeIndex];
    this.color = PARTICLE_CONFIG.COLORS[Math.floor(Math.random() * PARTICLE_CONFIG.COLORS.length)];

    this.pulsePhase = Math.random() * Math.PI * 2;
    this.calculateRadius();
  }

  /**
   * 计算粒子半径，使用映射替代switch语句，提高性能
   */
  private calculateRadius(): void {
    const calculator = RADIUS_CALCULATORS[this.shape];
    if (calculator) {
      this.radius = calculator(this.baseSize);
    } else {
      // 兜底逻辑，确保半径始终有值
      this.radius = this.baseSize;
    }
  }

  /**
   * 更新粒子状态
   * @param canvasWidth 画布宽度
   * @param canvasHeight 画布高度
   */
  update(canvasWidth: number, canvasHeight: number): void {
    // 更新脉冲效果
    this.pulsePhase += PARTICLE_CONFIG.PULSE_SPEED;
    const pulse = PARTICLE_CONFIG.PULSE_AMPLITUDE * Math.sin(this.pulsePhase);
    this.size = this.baseSize * (1 + pulse);

    // 更新旋转和位置
    this.rotation += this.rotationSpeed;
    this.x += this.speedX;
    this.y += this.speedY;

    // 边界碰撞检测和反弹
    if (this.x < 0 || this.x > canvasWidth) {
      this.speedX *= -1;
      this.x = Math.max(0, Math.min(canvasWidth, this.x));
    }
    if (this.y < 0 || this.y > canvasHeight) {
      this.speedY *= -1;
      this.y = Math.max(0, Math.min(canvasHeight, this.y));
    }
  }

  /**
   * 绘制粒子
   * @param ctx Canvas上下文
   */
  draw(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.fillStyle = this.color;

    // 使用映射替代switch语句绘制形状
    const drawer = SHAPE_DRAWERS[this.shape];
    if (drawer) {
      drawer(ctx, this.size);
    } else {
      // 兜底绘制圆形
      SHAPE_DRAWERS[Shape.CIRCLE](ctx, this.size);
    }

    ctx.restore();
  }
}

/**
 * 更新粒子网格，用于优化粒子间交互计算
 * @param particles 粒子数组
 * @param cellSize 网格单元格大小
 * @returns 网格Map，键为网格坐标，值为该网格中的粒子索引数组
 */
export function updateParticleGrid(particles: BaseParticle[], cellSize: number) {
  const grid = new Map<string, number[]>();

  // 生成网格键的高效方法
  const getGridKey = (x: number, y: number): string => {
    const gridX = Math.floor(x / cellSize);
    const gridY = Math.floor(y / cellSize);
    return `${gridX},${gridY}`;
  };

  // 填充网格
  particles.forEach((particle, index) => {
    const key = getGridKey(particle.x, particle.y);
    const cell = grid.get(key);
    if (cell) {
      cell.push(index);
    } else {
      grid.set(key, [index]);
    }
  });

  return grid;
}

/**
 * 应用鼠标影响到粒子
 * @param particles 粒子数组
 * @param mouseX 鼠标X坐标
 * @param mouseY 鼠标Y坐标
 * @param mouseActive 鼠标是否激活
 */
export function applyMouseInfluence(
  particles: BaseParticle[],
  mouseX: number,
  mouseY: number,
  mouseActive: boolean
): void {
  if (!mouseActive) return;

  const { MAX_SPEED, MOUSE_INFLUENCE_RADIUS, MOUSE_FORCE_BASE } = PARTICLE_CONFIG;

  for (const particle of particles) {
    // 计算粒子与鼠标的距离和方向
    const dx = particle.x - mouseX;
    const dy = particle.y - mouseY;
    const dist = Math.hypot(dx, dy);

    // 只影响在鼠标影响范围内的粒子
    if (dist > 0 && dist < MOUSE_INFLUENCE_RADIUS) {
      // 计算影响力强度
      const strength = 1 - dist / MOUSE_INFLUENCE_RADIUS;
      const accel = MOUSE_FORCE_BASE * strength;

      // 计算单位方向向量
      const nx = dx / dist;
      const ny = dy / dist;

      // 应用力到粒子速度
      particle.speedX += nx * accel;
      particle.speedY += ny * accel;

      // 限制粒子最大速度
      const currentSpeed = Math.hypot(particle.speedX, particle.speedY);
      if (currentSpeed > MAX_SPEED) {
        const speedRatio = MAX_SPEED / currentSpeed;
        particle.speedX *= speedRatio;
        particle.speedY *= speedRatio;
      }
    }
  }
}
