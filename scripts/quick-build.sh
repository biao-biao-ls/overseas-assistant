#!/bin/bash

# 快速构建脚本 - 只构建和打包，不公证不上传
# 用于快速测试构建流程

set -e

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

echo
log_info "=== 快速构建脚本 ==="
echo

# 检查是否在项目根目录
if [ ! -f "package.json" ]; then
    echo "错误: 请在项目根目录运行此脚本"
    exit 1
fi

# 获取版本号
VERSION=$(node -p "require('./package.json').version")
log_info "当前版本: $VERSION"

# 清理
log_info "清理旧文件..."
rm -rf build/ package/mas/

# 构建
log_info "构建项目..."
npm run build

# 打包
log_info "打包 App Store 版本..."
npm run package:app-store

# 验证
if [ -f "package/mas/JLCONE-${VERSION}.pkg" ]; then
    log_success "构建完成!"
    echo "文件位置: package/mas/JLCONE-${VERSION}.pkg"
    echo "文件大小: $(du -h "package/mas/JLCONE-${VERSION}.pkg" | cut -f1)"
else
    echo "错误: 构建失败"
    exit 1
fi