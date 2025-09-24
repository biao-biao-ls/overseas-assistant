#!/bin/bash

# 版本号管理脚本
# 用于同时更新 package.json 和 src/res/config.json 中的版本号

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

# 显示帮助信息
show_help() {
    echo "版本号管理脚本"
    echo
    echo "用法: $0 [命令] [版本号]"
    echo
    echo "命令:"
    echo "  set <版本号>        设置指定版本号"
    echo "  patch              增加补丁版本号 (x.y.z -> x.y.z+1)"
    echo "  minor              增加次版本号 (x.y.z -> x.y+1.0)"
    echo "  major              增加主版本号 (x.y.z -> x+1.0.0)"
    echo "  current            显示当前版本号"
    echo "  -h, --help         显示此帮助信息"
    echo
    echo "示例:"
    echo "  $0 set 1.2.3       # 设置版本为 1.2.3"
    echo "  $0 patch            # 1.0.2 -> 1.0.3"
    echo "  $0 minor            # 1.0.2 -> 1.1.0"
    echo "  $0 major            # 1.0.2 -> 2.0.0"
    echo "  $0 current          # 显示当前版本"
    echo
}

# 验证版本号格式
validate_version() {
    local version="$1"
    if [[ ! $version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        log_error "无效的版本号格式: $version"
        log_error "版本号格式应为: x.y.z (例如: 1.0.0)"
        exit 1
    fi
}

# 获取当前版本号
get_current_version() {
    if [ ! -f "package.json" ]; then
        log_error "找不到 package.json 文件"
        exit 1
    fi
    
    node -p "require('./package.json').version" 2>/dev/null || {
        log_error "无法从 package.json 读取版本号"
        exit 1
    }
}

# 更新 package.json 中的版本号
update_package_json() {
    local new_version="$1"
    
    log_info "更新 package.json 版本号: $new_version"
    
    # 使用 node 脚本更新版本号
    node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        pkg.version = '$new_version';
        fs.writeFileSync('package.json', JSON.stringify(pkg, null, 4) + '\n');
    " || {
        log_error "更新 package.json 失败"
        exit 1
    }
    
    log_success "package.json 版本号已更新"
}

# 更新 src/res/config.json 中的版本号
update_config_json() {
    local new_version="$1"
    local config_file="src/res/config.json"
    
    log_info "更新 $config_file 版本号: $new_version"
    
    if [ ! -f "$config_file" ]; then
        log_error "找不到 $config_file 文件"
        exit 1
    fi
    
    # 使用 node 脚本更新版本号
    node -e "
        const fs = require('fs');
        let config;
        try {
            config = JSON.parse(fs.readFileSync('$config_file', 'utf8'));
        } catch (e) {
            console.error('解析 $config_file 失败:', e.message);
            process.exit(1);
        }
        config.version = '$new_version';
        fs.writeFileSync('$config_file', JSON.stringify(config, null, 4) + '\n');
    " || {
        log_error "更新 $config_file 失败"
        exit 1
    }
    
    log_success "$config_file 版本号已更新"
}

# 增加版本号
increment_version() {
    local current_version="$1"
    local increment_type="$2"
    
    # 分解版本号
    IFS='.' read -r major minor patch <<< "$current_version"
    
    case $increment_type in
        "patch")
            patch=$((patch + 1))
            ;;
        "minor")
            minor=$((minor + 1))
            patch=0
            ;;
        "major")
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        *)
            log_error "未知的增量类型: $increment_type"
            exit 1
            ;;
    esac
    
    echo "$major.$minor.$patch"
}

# 设置版本号
set_version() {
    local new_version="$1"
    
    validate_version "$new_version"
    
    local current_version
    current_version=$(get_current_version)
    
    if [ "$current_version" = "$new_version" ]; then
        log_warning "版本号未改变: $new_version"
        return 0
    fi
    
    log_info "版本号变更: $current_version -> $new_version"
    
    # 备份文件
    cp package.json package.json.backup
    cp src/res/config.json src/res/config.json.backup
    
    # 更新版本号
    update_package_json "$new_version"
    update_config_json "$new_version"
    
    # 验证更新结果
    local updated_version
    updated_version=$(get_current_version)
    
    if [ "$updated_version" = "$new_version" ]; then
        log_success "版本号更新成功: $new_version"
        
        # 删除备份文件
        rm -f package.json.backup src/res/config.json.backup
        
        # 显示更新后的文件内容
        echo
        log_info "更新后的文件内容:"
        echo "package.json: $(grep '"version"' package.json)"
        echo "config.json: $(grep '"version"' src/res/config.json)"
    else
        log_error "版本号更新验证失败"
        log_error "期望: $new_version, 实际: $updated_version"
        
        # 恢复备份文件
        mv package.json.backup package.json
        mv src/res/config.json.backup src/res/config.json
        exit 1
    fi
}

# 显示当前版本号
show_current_version() {
    local current_version
    current_version=$(get_current_version)
    
    echo
    log_info "当前版本信息:"
    echo "package.json: $current_version"
    
    # 检查 config.json 中是否有版本号
    if grep -q '"version"' src/res/config.json 2>/dev/null; then
        local config_version
        config_version=$(node -p "require('./src/res/config.json').version" 2>/dev/null || echo "未找到")
        echo "config.json: $config_version"
    else
        echo "config.json: 未设置版本号"
    fi
    echo
}

# 主函数
main() {
    echo
    log_info "=== 版本号管理脚本 ==="
    echo
    
    # 检查是否在项目根目录
    if [ ! -f "package.json" ]; then
        log_error "请在项目根目录运行此脚本"
        exit 1
    fi
    
    # 检查参数
    if [ $# -eq 0 ]; then
        show_help
        exit 1
    fi
    
    case "$1" in
        "set")
            if [ $# -ne 2 ]; then
                log_error "set 命令需要指定版本号"
                echo "用法: $0 set <版本号>"
                exit 1
            fi
            set_version "$2"
            ;;
        "patch"|"minor"|"major")
            local current_version
            current_version=$(get_current_version)
            local new_version
            new_version=$(increment_version "$current_version" "$1")
            set_version "$new_version"
            ;;
        "current")
            show_current_version
            ;;
        "-h"|"--help")
            show_help
            ;;
        *)
            log_error "未知命令: $1"
            show_help
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"