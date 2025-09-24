#!/bin/bash

# DMG 文件公证脚本
# 用于公证 macOS 分发版本的 DMG 文件

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# 加载配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/config.sh" ]; then
    source "$SCRIPT_DIR/config.sh"
else
    # 默认配置
    APPLE_ID="1140457303@qq.com"
    APP_SPECIFIC_PASSWORD="oznl-zlce-kapq-nyjd"
    TEAM_ID="FPD7225NBW"
    BUNDLE_ID="com.jlcpcb.www"
fi

# 获取版本号
VERSION=$(node -p "require('./package.json').version")

# 公证 DMG 文件
notarize_dmg() {
    local DMG_PATH="$1"
    
    if [ ! -f "$DMG_PATH" ]; then
        log_error "DMG 文件不存在: $DMG_PATH"
        exit 1
    fi
    
    log_info "开始公证 DMG 文件: $DMG_PATH"
    
    # 使用 notarytool 提交公证
    log_info "提交公证请求..."
    NOTARIZE_OUTPUT=$(xcrun notarytool submit "$DMG_PATH" \
        --apple-id "$APPLE_ID" \
        --password "$APP_SPECIFIC_PASSWORD" \
        --team-id "$TEAM_ID" \
        --wait)
    
    echo "$NOTARIZE_OUTPUT"
    
    # 检查公证结果
    if echo "$NOTARIZE_OUTPUT" | grep -q "status: Accepted"; then
        log_success "DMG 公证成功"
        
        # 装订公证票据
        log_info "装订公证票据..."
        xcrun stapler staple "$DMG_PATH"
        if [ $? -eq 0 ]; then
            log_success "公证票据装订完成"
        else
            log_warning "公证票据装订失败"
        fi
        
        # 验证装订结果
        log_info "验证公证票据..."
        xcrun stapler validate "$DMG_PATH"
        if [ $? -eq 0 ]; then
            log_success "公证票据验证成功"
        else
            log_warning "公证票据验证失败"
        fi
        
    else
        log_error "DMG 公证失败"
        
        # 获取公证 ID 并显示详细错误信息
        SUBMISSION_ID=$(echo "$NOTARIZE_OUTPUT" | grep "id:" | awk '{print $2}')
        if [ ! -z "$SUBMISSION_ID" ]; then
            log_info "获取公证详细信息..."
            xcrun notarytool log "$SUBMISSION_ID" \
                --apple-id "$APPLE_ID" \
                --password "$APP_SPECIFIC_PASSWORD" \
                --team-id "$TEAM_ID"
        fi
        
        exit 1
    fi
}

# 主函数
main() {
    echo
    log_info "=== DMG 公证脚本 ==="
    echo
    
    # 检查参数
    if [ $# -eq 0 ]; then
        # 自动查找 DMG 文件
        DMG_FILE=$(find package -name "*.dmg" | head -1)
        if [ -z "$DMG_FILE" ]; then
            log_error "未找到 DMG 文件"
            echo "用法: $0 [DMG文件路径]"
            echo "或者先构建 DMG 文件: npm run package:mac"
            exit 1
        fi
        log_info "自动找到 DMG 文件: $DMG_FILE"
    else
        DMG_FILE="$1"
    fi
    
    # 执行公证
    notarize_dmg "$DMG_FILE"
    
    echo
    log_success "DMG 公证流程完成"
    echo "文件: $DMG_FILE"
    echo
}

# 运行主函数
main "$@"