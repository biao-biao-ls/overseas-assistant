#!/bin/bash

# 环境配置脚本
# 用于在新 Mac 上快速配置开发环境

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo
log_info "=== JLCONE 开发环境配置脚本 ==="
echo

# 检查 macOS 版本
log_info "检查系统环境..."
MACOS_VERSION=$(sw_vers -productVersion)
log_info "macOS 版本: $MACOS_VERSION"

# 检查 Xcode
if command -v xcode-select &> /dev/null; then
    XCODE_PATH=$(xcode-select -p)
    log_success "Xcode 已安装: $XCODE_PATH"
else
    log_error "Xcode 未安装，请先安装 Xcode"
    exit 1
fi

# 检查 Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    log_success "Node.js 已安装: $NODE_VERSION"
else
    log_error "Node.js 未安装，请先安装 Node.js"
    exit 1
fi

# 检查证书
log_info "检查开发者证书..."
CERT_COUNT=$(security find-identity -v -p codesigning | grep "3rd Party Mac Developer" | wc -l | tr -d ' ')
if [ "$CERT_COUNT" -ge 2 ]; then
    log_success "找到 $CERT_COUNT 个 Mac Developer 证书"
    security find-identity -v -p codesigning | grep "3rd Party Mac Developer"
else
    log_warning "未找到足够的 Mac Developer 证书 (当前: $CERT_COUNT, 需要: 2)"
    log_warning "需要以下证书："
    echo "  - 3rd Party Mac Developer Application"
    echo "  - 3rd Party Mac Developer Installer"
fi

# 检查 Provisioning Profile
log_info "检查 Provisioning Profile..."
if [ -f "mas/macdistributionprofile.provisionprofile" ]; then
    EXPIRY=$(security cms -D -i mas/macdistributionprofile.provisionprofile | grep -A1 "ExpirationDate" | tail -1 | sed 's/.*<date>\(.*\)<\/date>.*/\1/')
    log_success "Provisioning Profile 已配置"
    log_info "到期时间: $EXPIRY"
else
    log_error "未找到 Provisioning Profile: mas/macdistributionprofile.provisionprofile"
fi

# 检查配置文件
log_info "检查配置文件..."
if [ -f "scripts/config.sh" ]; then
    log_success "配置文件已存在: scripts/config.sh"
else
    log_warning "配置文件不存在，创建默认配置..."
    cat > scripts/config.sh << 'EOF'
#!/bin/bash

# Apple Developer 账户信息
export APPLE_ID="1140457303@qq.com"
export APP_SPECIFIC_PASSWORD="oznl-zlce-kapq-nyjd"
export TEAM_ID="FPD7225NBW"

# 应用信息
export BUNDLE_ID="com.jlcpcb.www"
export APP_NAME="JLCONE"

# 可选配置
export SKIP_NOTARIZATION=true
export AUTO_UPLOAD=true
export USE_ALTOOL=false
EOF
    chmod +x scripts/config.sh
    log_success "已创建默认配置文件"
fi

# 安装项目依赖
log_info "检查项目依赖..."
if [ -f "package.json" ]; then
    if [ -d "node_modules" ]; then
        log_success "项目依赖已安装"
    else
        log_info "安装项目依赖..."
        if npm install; then
            log_success "项目依赖安装完成"
        else
            log_warning "项目依赖安装失败，但继续检查其他配置"
        fi
    fi
else
    log_error "未找到 package.json 文件"
fi

# 检查 Transporter
log_info "检查 Transporter..."
if [ -d "/Applications/Transporter.app" ]; then
    log_success "Transporter 已安装"
else
    log_warning "Transporter 未安装"
    log_info "请从 App Store 安装 Transporter 应用"
fi

# 检查权限文件
log_info "检查权限文件..."
PLIST_FILES=("mas/entitlements.mas.plist" "mas/entitlements.mas.inherit.plist" "mas/entitlements.mas.loginhelper.plist")
for plist in "${PLIST_FILES[@]}"; do
    if [ -f "$plist" ]; then
        log_success "找到权限文件: $plist"
    else
        log_error "缺少权限文件: $plist"
    fi
done

# 检查构建配置
log_info "检查构建配置..."
if [ -f "builder.js" ]; then
    log_success "构建配置文件存在: builder.js"
else
    log_error "缺少构建配置文件: builder.js"
fi

# 测试构建
log_info "测试构建环境..."
if npm run quick-build > /dev/null 2>&1; then
    log_success "构建测试成功"
else
    log_error "构建测试失败，请检查环境配置"
fi

echo
log_success "=== 环境配置检查完成 ==="
echo
log_info "下一步操作："
echo "1. 确保所有证书已正确安装"
echo "2. 验证 Provisioning Profile 有效"
echo "3. 运行 'npm run release:app-store' 进行完整测试"
echo