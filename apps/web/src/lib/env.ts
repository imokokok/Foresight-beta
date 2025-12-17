/**
 * 环境变量验证和类型安全访问
 * 使用此文件确保所有必需的环境变量都已配置
 */

interface EnvConfig {
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_KEY?: string;
  
  // JWT
  JWT_SECRET: string;
  
  // 网络配置
  NEXT_PUBLIC_RELAYER_URL?: string;
  
  // RPC URLs
  NEXT_PUBLIC_RPC_SEPOLIA?: string;
  NEXT_PUBLIC_RPC_POLYGON?: string;
  NEXT_PUBLIC_RPC_POLYGON_AMOY?: string;
  
  // USDC Addresses
  NEXT_PUBLIC_USDC_ADDRESS_SEPOLIA?: string;
  NEXT_PUBLIC_USDC_ADDRESS_POLYGON?: string;
  NEXT_PUBLIC_USDC_ADDRESS_AMOY?: string;
  
  // 其他
  NODE_ENV: 'development' | 'production' | 'test';
}

/**
 * 验证环境变量
 */
function validateEnv(): EnvConfig {
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];

  const missing = requiredVars.filter(
    (varName) => !process.env[varName]
  );

  if (missing.length > 0) {
    throw new Error(
      `❌ 缺少必需的环境变量: ${missing.join(', ')}\n` +
      `请在 .env.local 文件中配置这些变量。`
    );
  }

  // 开发环境警告
  if (process.env.NODE_ENV === 'development') {
    const warnings: string[] = [];

    if (!process.env.SUPABASE_SERVICE_KEY) {
      warnings.push('⚠️  SUPABASE_SERVICE_KEY 未配置，某些 API 功能可能受限');
    }

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-secret-key-change-in-production') {
      warnings.push('⚠️  JWT_SECRET 使用默认值，生产环境请务必更改！');
    }

    if (warnings.length > 0) {
      console.warn('\n' + warnings.join('\n') + '\n');
    }
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
    JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    NEXT_PUBLIC_RELAYER_URL: process.env.NEXT_PUBLIC_RELAYER_URL,
    NEXT_PUBLIC_RPC_SEPOLIA: process.env.NEXT_PUBLIC_RPC_SEPOLIA,
    NEXT_PUBLIC_RPC_POLYGON: process.env.NEXT_PUBLIC_RPC_POLYGON,
    NEXT_PUBLIC_RPC_POLYGON_AMOY: process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY,
    NEXT_PUBLIC_USDC_ADDRESS_SEPOLIA: process.env.NEXT_PUBLIC_USDC_ADDRESS_SEPOLIA,
    NEXT_PUBLIC_USDC_ADDRESS_POLYGON: process.env.NEXT_PUBLIC_USDC_ADDRESS_POLYGON,
    NEXT_PUBLIC_USDC_ADDRESS_AMOY: process.env.NEXT_PUBLIC_USDC_ADDRESS_AMOY,
    NODE_ENV: (process.env.NODE_ENV as any) || 'development',
  };
}

// 导出验证后的环境变量
export const env = validateEnv();

// 工具函数：根据链 ID 获取 RPC URL
export function getRpcUrl(chainId: number): string | null {
  switch (chainId) {
    case 11155111: // Sepolia
      return env.NEXT_PUBLIC_RPC_SEPOLIA || 'https://rpc.sepolia.org';
    case 137: // Polygon
      return env.NEXT_PUBLIC_RPC_POLYGON || 'https://polygon-rpc.com';
    case 80002: // Polygon Amoy
      return env.NEXT_PUBLIC_RPC_POLYGON_AMOY || 'https://rpc-amoy.polygon.technology';
    default:
      return null;
  }
}

// 工具函数：根据链 ID 获取 USDC 地址
export function getUsdcAddress(chainId: number): string | null {
  switch (chainId) {
    case 11155111: // Sepolia
      return env.NEXT_PUBLIC_USDC_ADDRESS_SEPOLIA || null;
    case 137: // Polygon
      return env.NEXT_PUBLIC_USDC_ADDRESS_POLYGON || null;
    case 80002: // Polygon Amoy
      return env.NEXT_PUBLIC_USDC_ADDRESS_AMOY || null;
    default:
      return null;
  }
}

