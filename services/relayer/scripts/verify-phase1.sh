#!/bin/bash
# Phase 1 功能验证脚本

set -e

echo "🔍 Phase 1 功能验证"
echo "===================="

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# 1. 检查编译产物
echo ""
echo "📦 检查编译产物..."
if [ -f "dist/index.js" ] && [ -f "dist/monitoring/metrics.js" ] && [ -f "dist/redis/client.js" ]; then
    check_pass "编译产物完整"
else
    check_fail "缺少编译产物，请运行 'npm run build'"
    exit 1
fi

# 2. 检查测试
echo ""
echo "🧪 运行测试..."
if npm test > /dev/null 2>&1; then
    check_pass "所有测试通过"
else
    check_fail "测试失败"
fi

# 3. 检查 Docker Compose 文件
echo ""
echo "🐳 检查 Docker 配置..."
if [ -f "docker-compose.monitoring.yml" ]; then
    check_pass "docker-compose.monitoring.yml 存在"
else
    check_fail "docker-compose.monitoring.yml 缺失"
fi

# 4. 检查 Prometheus 配置
if [ -f "prometheus.yml" ]; then
    check_pass "prometheus.yml 存在"
else
    check_fail "prometheus.yml 缺失"
fi

# 5. 检查 Grafana Dashboard
if [ -f "grafana/dashboards/relayer-overview.json" ]; then
    check_pass "Grafana Dashboard 存在"
else
    check_fail "Grafana Dashboard 缺失"
fi

# 6. 检查文档
echo ""
echo "📚 检查文档..."
if [ -f "MONITORING.md" ]; then
    check_pass "MONITORING.md 存在"
else
    check_fail "MONITORING.md 缺失"
fi

# 7. 检查 Redis 连接 (可选)
echo ""
echo "🔴 检查 Redis..."
if command -v redis-cli &> /dev/null; then
    if redis-cli ping > /dev/null 2>&1; then
        check_pass "Redis 已运行"
    else
        check_warn "Redis 未运行 (可选功能)"
    fi
else
    check_warn "redis-cli 未安装 (可选)"
fi

# 8. 检查 Docker (可选)
echo ""
echo "🐳 检查 Docker..."
if command -v docker &> /dev/null; then
    if docker info > /dev/null 2>&1; then
        check_pass "Docker 可用"
    else
        check_warn "Docker 未运行"
    fi
else
    check_warn "Docker 未安装"
fi

echo ""
echo "===================="
echo "✅ Phase 1 功能验证完成!"
echo ""
echo "📋 快速使用指南:"
echo ""
echo "  1. 启动监控栈 (可选):"
echo "     docker-compose -f docker-compose.monitoring.yml up -d"
echo ""
echo "  2. 启动 Relayer:"
echo "     REDIS_ENABLED=false npm start"
echo ""
echo "  3. 测试端点:"
echo "     curl http://localhost:3000/health"
echo "     curl http://localhost:3000/metrics"
echo ""
echo "  4. 访问 Grafana (如果启动了监控栈):"
echo "     http://localhost:3030 (admin/foresight123)"
echo ""

