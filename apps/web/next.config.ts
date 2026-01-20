import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // 避免 Next.js 在 monorepo + 多 lockfile 场景下错误推断 workspace root
  // apps/web -> ../../ 为仓库根目录（包含顶层 lockfile）
  outputFileTracingRoot: path.join(__dirname, "..", ".."),

  // 启用 gzip 压缩
  compress: true,

  // 生产环境自动移除 console.log
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? {
            exclude: ["error", "warn"], // 保留 error 和 warn
          }
        : false,
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "avatar.vercel.sh",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "www.transparenttextures.com",
      },
      {
        protocol: "https",
        hostname: "grainy-gradients.vercel.app",
      },
    ],
    // 图片优化配置
    formats: ["image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  async redirects() {
    return [{ source: "/", destination: "/trending", permanent: true }];
  },

  // 安全 Headers - 优化版本
  async headers() {
    const isProd = process.env.NODE_ENV === "production";

    const scriptSrc = isProd
      ? "script-src 'self' 'unsafe-inline' https://vercel.live https://*.sentry.io"
      : "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live https://*.sentry.io";

    return [
      {
        source: "/:path*",
        headers: [
          // 启用 DNS 预取，提升性能
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },

          // 严格的 HTTPS 策略
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },

          // 防止点击劫持
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },

          // 防止 MIME 类型嗅探
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },

          // 现代浏览器已默认启用 XSS 保护，保持此头以兼容旧浏览器
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },

          // 严格的 Referrer 策略
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },

          // 优化权限策略，禁用所有不必要的权限
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), midi=(), xr-spatial-tracking=(), accelerometer=(), gyroscope=(), magnetometer=(), screen-wake-lock=()",
          },

          // 优化 Content-Security-Policy
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // 生产环境移除 http:，只允许 https:
              `img-src 'self' data: blob: ${isProd ? "https:" : "https: http:"}`,
              "font-src 'self' data: https://fonts.gstatic.com",
              // 优化 connect-src，生产环境移除 localhost
              `connect-src 'self' https: wss: ${!isProd ? "http://localhost:* ws://localhost:*" : ""}`,
              "frame-src 'self' https://vercel.live",
              "worker-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'self'",
              // 生产环境强制 HTTPS
              isProd ? "upgrade-insecure-requests" : "",
              // 阻止不安全的 WebSocket 连接
              "block-all-mixed-content",
            ]
              .filter(Boolean)
              .join("; "),
          },
        ],
      },
    ];
  },

  // 生产环境优化
  productionBrowserSourceMaps: false,
  poweredByHeader: false,

  // 实验性特性 - 性能优化
  experimental: {
    // 🚀 优化：自动按需导入大型库，减少 bundle 大小
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "@tanstack/react-query",
      "ethers",
      "date-fns",
      "lodash",
      "recharts",
    ],
  },

  // Webpack 优化
  webpack: (config, { dev, isServer }) => {
    // 🚀 生产环境优化
    if (!dev && !isServer) {
      // 优化 chunk 分割策略
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: "all",
          minSize: 20000,
          maxSize: 244000,
          cacheGroups: {
            // 将 ethers 单独打包（大型库）
            ethers: {
              test: /[\\/]node_modules[\\/]ethers[\\/]/,
              name: "ethers",
              chunks: "all",
              priority: 30,
            },
            // 将 react-query 单独打包
            reactQuery: {
              test: /[\\/]node_modules[\\/]@tanstack[\\/]/,
              name: "react-query",
              chunks: "all",
              priority: 25,
            },
            // 将 framer-motion 单独打包
            framer: {
              test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
              name: "framer-motion",
              chunks: "all",
              priority: 20,
            },
            // 其他 vendor 库
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: "vendors",
              chunks: "all",
              priority: 10,
            },
          },
        },
      };
    }

    return config;
  },
};

// Sentry 配置选项
const sentryWebpackPluginOptions = {
  // 自动上传 source maps
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
};

// 导出配置（先 bundle analyzer，再 Sentry）
export default withSentryConfig(bundleAnalyzer(nextConfig), sentryWebpackPluginOptions);
