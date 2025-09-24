#!/bin/bash

# App Store 自动构建、签名、公证和上传脚本
# 作者: Kiro
# 用法: ./scripts/build-and-upload.sh

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
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

# 加载配置文件
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/config.sh" ]; then
    source "$SCRIPT_DIR/config.sh"
    log_info "已加载配置文件"
else
    log_warning "配置文件不存在，使用默认配置"
    # 默认配置
    APPLE_ID="1140457303@qq.com"
    APP_SPECIFIC_PASSWORD="oznl-zlce-kapq-nyjd"
    TEAM_ID="FPD7225NBW"
    BUNDLE_ID="com.jlcpcb.www"
    APP_NAME="JLCONE"
    SKIP_NOTARIZATION=false
    AUTO_UPLOAD=true
    USE_ALTOOL=false
fi

# 检查必要工具
check_dependencies() {
    log_info "检查必要工具..."
    
    if ! command -v npm &> /dev/null; then
        log_error "npm 未安装"
        exit 1
    fi
    
    if ! command -v xcrun &> /dev/null; then
        log_error "Xcode 命令行工具未安装"
        exit 1
    fi
    
    log_success "所有必要工具已安装"
}

# 获取版本号
get_version() {
    VERSION=$(node -p "require('./package.json').version")
    log_info "当前版本: $VERSION"
}

# 清理旧文件
cleanup() {
    log_info "清理旧的构建文件..."
    rm -rf build/
    rm -rf package/mas/
    log_success "清理完成"
}

# 构建项目
build_project() {
    log_info "开始构建项目..."
    npm run build
    if [ $? -eq 0 ]; then
        log_success "项目构建完成"
    else
        log_error "项目构建失败"
        exit 1
    fi
}

# 打包 App Store 版本
package_app_store() {
    log_info "开始打包 App Store 版本..."
    npm run package:app-store
    if [ $? -eq 0 ]; then
        log_success "App Store 打包完成"
    else
        log_error "App Store 打包失败"
        exit 1
    fi
}

# 验证签名
verify_signature() {
    log_info "验证应用签名..."
    
    APP_PATH="package/mas/${APP_NAME}.app"
    PKG_PATH="package/mas/${APP_NAME}-${VERSION}.pkg"
    
    if [ ! -d "$APP_PATH" ]; then
        log_error "找不到应用文件: $APP_PATH"
        exit 1
    fi
    
    if [ ! -f "$PKG_PATH" ]; then
        log_error "找不到安装包文件: $PKG_PATH"
        exit 1
    fi
    
    # 验证 .app 签名
    log_info "验证 .app 文件签名..."
    codesign -dv --verbose=4 "$APP_PATH"
    if [ $? -eq 0 ]; then
        log_success ".app 文件签名验证通过"
    else
        log_error ".app 文件签名验证失败"
        exit 1
    fi
    
    # 验证 .pkg 签名
    log_info "验证 .pkg 文件签名..."
    pkgutil --check-signature "$PKG_PATH"
    if [ $? -eq 0 ]; then
        log_success ".pkg 文件签名验证通过"
    else
        log_error ".pkg 文件签名验证失败"
        exit 1
    fi
}

# 公证应用
notarize_app() {
    if [ "$SKIP_NOTARIZATION" = true ]; then
        log_warning "跳过公证步骤"
        return 0
    fi
    
    log_info "开始公证应用..."
    
    PKG_PATH="package/mas/${APP_NAME}-${VERSION}.pkg"
    
    # 对于 App Store 发布，通常不需要公证 .pkg 文件
    # App Store Connect 会处理公证过程
    log_info "注意: App Store 发布的 .pkg 文件通常不需要预先公证"
    log_info "App Store Connect 会在审核过程中处理公证"
    
    # 询问用户是否仍要进行公证
    read -p "是否仍要对 .pkg 文件进行公证？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "跳过公证步骤，直接准备上传"
        return 0
    fi
    
    # 提交公证
    log_info "提交应用进行公证..."
    NOTARIZE_OUTPUT=$(xcrun notarytool submit "$PKG_PATH" \
        --apple-id "$APPLE_ID" \
        --password "$APP_SPECIFIC_PASSWORD" \
        --team-id "$TEAM_ID" \
        --wait)
    
    echo "$NOTARIZE_OUTPUT"
    
    # 检查公证结果
    if echo "$NOTARIZE_OUTPUT" | grep -q "status: Accepted"; then
        log_success "应用公证成功"
        
        # 装订公证票据
        log_info "装订公证票据..."
        xcrun stapler staple "$PKG_PATH"
        if [ $? -eq 0 ]; then
            log_success "公证票据装订完成"
        else
            log_warning "公证票据装订失败，但不影响上传"
        fi
    else
        log_error "应用公证失败"
        echo "$NOTARIZE_OUTPUT"
        
        # 获取公证 ID 并显示详细错误信息
        SUBMISSION_ID=$(echo "$NOTARIZE_OUTPUT" | grep "id:" | awk '{print $2}')
        if [ ! -z "$SUBMISSION_ID" ]; then
            log_info "获取公证详细信息..."
            xcrun notarytool log "$SUBMISSION_ID" \
                --apple-id "$APPLE_ID" \
                --password "$APP_SPECIFIC_PASSWORD" \
                --team-id "$TEAM_ID"
        fi
        
        read -p "公证失败，是否继续上传？(y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# 打开 Transporter 上传
open_transporter() {
    if [ "$AUTO_UPLOAD" = false ]; then
        log_info "自动上传已禁用，跳过上传步骤"
        return 0
    fi
    
    log_info "准备使用 Transporter 上传..."
    
    PKG_PATH="package/mas/${APP_NAME}-${VERSION}.pkg"
    
    # 检查是否强制使用命令行工具
    if [ "$USE_ALTOOL" = true ]; then
        log_info "强制使用命令行工具上传..."
        upload_via_altool
        return
    fi
    
    # 检查 Transporter 是否安装
    if [ ! -d "/Applications/Transporter.app" ]; then
        log_warning "Transporter 未安装，尝试使用命令行上传..."
        upload_via_altool
        return
    fi
    
    # 显示文件信息
    log_info "准备上传的文件信息:"
    echo "  文件路径: $PKG_PATH"
    echo "  文件大小: $(du -h "$PKG_PATH" | cut -f1)"
    echo "  Bundle ID: $BUNDLE_ID"
    echo "  版本号: $VERSION"
    
    # 打开 Transporter
    log_info "正在打开 Transporter..."
    open -a Transporter "$PKG_PATH"
    
    log_success "Transporter 已打开，请在应用中完成上传"
    log_info "上传完成后，请到 App Store Connect 查看构建版本"
}

# 使用 altool 命令行上传（备用方案）
upload_via_altool() {
    log_info "使用命令行工具上传..."
    
    PKG_PATH="package/mas/${APP_NAME}-${VERSION}.pkg"
    
    xcrun altool --upload-app \
        -f "$PKG_PATH" \
        -u "$APPLE_ID" \
        -p "$APP_SPECIFIC_PASSWORD" \
        --verbose
    
    if [ $? -eq 0 ]; then
        log_success "应用上传成功"
        log_info "请到 App Store Connect 查看构建版本"
    else
        log_error "应用上传失败"
        exit 1
    fi
}

# 显示完成信息
show_completion_info() {
    echo
    log_success "=== 构建和上传流程完成 ==="
    echo
    echo "📦 构建信息:"
    echo "  应用名称: $APP_NAME"
    echo "  版本号: $VERSION"
    echo "  Bundle ID: $BUNDLE_ID"
    echo "  文件路径: package/mas/${APP_NAME}-${VERSION}.pkg"
    echo
    if [ "$AUTO_UPLOAD" = true ]; then
        echo "🔗 下一步操作:"
        echo "  1. 在 App Store Connect 中查看构建版本"
        echo "  2. 填写应用信息和截图"
        echo "  3. 提交审核"
        echo
        echo "🌐 App Store Connect: https://appstoreconnect.apple.com/"
    else
        echo "📁 文件已准备就绪，可以手动上传到 App Store Connect"
    fi
    echo
}

# 显示帮助信息
show_help() {
    echo "JLCONE App Store 自动构建和上传脚本"
    echo
    echo "用法: $0 [选项]"
    echo
    echo "选项:"
    echo "  -h, --help              显示此帮助信息"
    echo "  --skip-build           跳过构建步骤"
    echo "  --skip-notarization    跳过公证步骤（默认已跳过）"
    echo "  --no-skip-notarization 强制启用公证步骤"
    echo "  --no-upload            只构建不上传"
    echo "  --use-altool           强制使用命令行工具上传"
    echo "  --clean-only           只清理构建文件"
    echo
    echo "示例:"
    echo "  $0                     # 完整流程"
    echo "  $0 --skip-build        # 跳过构建，直接打包上传"
    echo "  $0 --no-upload         # 只构建和打包，不上传"
    echo
}

# 解析命令行参数
parse_arguments() {
    SKIP_BUILD=false
    CLEAN_ONLY=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --skip-notarization)
                SKIP_NOTARIZATION=true
                shift
                ;;
            --no-skip-notarization)
                SKIP_NOTARIZATION=false
                shift
                ;;
            --no-upload)
                AUTO_UPLOAD=false
                shift
                ;;
            --use-altool)
                USE_ALTOOL=true
                shift
                ;;
            --clean-only)
                CLEAN_ONLY=true
                shift
                ;;
            *)
                log_error "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# 主函数
main() {
    echo
    log_info "=== JLCONE App Store 自动构建和上传脚本 ==="
    echo
    
    # 检查是否在项目根目录
    if [ ! -f "package.json" ]; then
        log_error "请在项目根目录运行此脚本"
        exit 1
    fi
    
    # 解析命令行参数
    parse_arguments "$@"
    
    # 执行流程
    check_dependencies
    get_version
    
    if [ "$CLEAN_ONLY" = true ]; then
        cleanup
        log_success "清理完成"
        exit 0
    fi
    
    cleanup
    
    if [ "$SKIP_BUILD" = false ]; then
        build_project
    else
        # 检查是否存在构建文件
        if [ ! -f "build/main.js" ]; then
            log_warning "跳过构建但未找到构建文件，将执行构建..."
            build_project
        else
            log_info "跳过构建步骤，使用现有构建文件"
        fi
    fi
    
    package_app_store
    verify_signature
    notarize_app
    
    if [ "$AUTO_UPLOAD" = true ]; then
        open_transporter
    fi
    
    show_completion_info
}

# 捕获中断信号
trap 'log_error "脚本被中断"; exit 1' INT TERM

# 运行主函数
main "$@"