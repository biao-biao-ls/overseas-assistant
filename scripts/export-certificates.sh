#!/bin/bash

# 证书导出脚本
# 用于从当前 Mac 导出开发者证书

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

# 显示帮助信息
show_help() {
    echo "证书导出脚本"
    echo
    echo "用法: $0 [输出目录]"
    echo
    echo "参数:"
    echo "  输出目录    证书导出的目标目录 (默认: ./certificates)"
    echo
    echo "选项:"
    echo "  -h, --help  显示此帮助信息"
    echo
    echo "示例:"
    echo "  $0                    # 导出到 ./certificates"
    echo "  $0 ~/Desktop/certs    # 导出到指定目录"
    echo
}

# 查找证书
find_certificates() {
    log_info "查找开发者证书..."
    
    # 查找 Application 证书
    APP_CERT_HASH=$(security find-identity -v -p codesigning | grep "3rd Party Mac Developer Application.*FPD7225NBW" | awk '{print $2}' | head -1)
    
    # 查找 Installer 证书
    INSTALLER_CERT_HASH=$(security find-identity -v -p codesigning | grep "3rd Party Mac Developer Installer.*FPD7225NBW" | awk '{print $2}' | head -1)
    
    if [ -z "$APP_CERT_HASH" ]; then
        log_error "未找到 3rd Party Mac Developer Application 证书"
        return 1
    fi
    
    if [ -z "$INSTALLER_CERT_HASH" ]; then
        log_error "未找到 3rd Party Mac Developer Installer 证书"
        return 1
    fi
    
    log_success "找到 Application 证书: $APP_CERT_HASH"
    log_success "找到 Installer 证书: $INSTALLER_CERT_HASH"
    
    return 0
}

# 导出证书
export_certificate() {
    local cert_hash="$1"
    local cert_name="$2"
    local output_file="$3"
    
    log_info "导出证书: $cert_name"
    
    # 提示用户输入密码
    echo -n "请为 $cert_name 证书设置导出密码: "
    read -s password
    echo
    
    # 导出证书
    if security export -k login.keychain -t identities -f pkcs12 -o "$output_file" "$cert_hash" -P "$password"; then
        log_success "证书已导出: $output_file"
    else
        log_error "证书导出失败: $cert_name"
        return 1
    fi
}

# 复制配置文件
copy_config_files() {
    local output_dir="$1"
    
    log_info "复制配置文件..."
    
    # 复制 Provisioning Profile
    if [ -f "mas/macdistributionprofile.provisionprofile" ]; then
        cp "mas/macdistributionprofile.provisionprofile" "$output_dir/"
        log_success "已复制 Provisioning Profile"
    else
        log_warning "未找到 Provisioning Profile: mas/macdistributionprofile.provisionprofile"
    fi
    
    # 复制权限文件
    local plist_files=("mas/entitlements.mas.plist" "mas/entitlements.mas.inherit.plist" "mas/entitlements.mas.loginhelper.plist")
    for plist in "${plist_files[@]}"; do
        if [ -f "$plist" ]; then
            cp "$plist" "$output_dir/"
            log_success "已复制权限文件: $(basename "$plist")"
        else
            log_warning "未找到权限文件: $plist"
        fi
    done
    
    # 创建配置文件模板
    cat > "$output_dir/config.template.sh" << 'EOF'
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
    chmod +x "$output_dir/config.template.sh"
    log_success "已创建配置文件模板: config.template.sh"
}

# 创建导入脚本
create_import_script() {
    local output_dir="$1"
    
    log_info "创建导入脚本..."
    
    cat > "$output_dir/import-certificates.sh" << 'EOF'
#!/bin/bash

# 证书导入脚本
# 在新 Mac 上运行此脚本导入证书

set -e

echo "=== JLCONE 证书导入脚本 ==="
echo

# 检查文件
if [ ! -f "developer-application.p12" ] || [ ! -f "developer-installer.p12" ]; then
    echo "错误: 未找到证书文件"
    echo "请确保以下文件存在:"
    echo "  - developer-application.p12"
    echo "  - developer-installer.p12"
    exit 1
fi

# 导入证书
echo "导入 Application 证书..."
security import developer-application.p12 -k ~/Library/Keychains/login.keychain-db

echo "导入 Installer 证书..."
security import developer-installer.p12 -k ~/Library/Keychains/login.keychain-db

# 验证导入
echo
echo "验证证书导入..."
security find-identity -v -p codesigning | grep "3rd Party Mac Developer"

echo
echo "证书导入完成！"
echo
echo "下一步操作:"
echo "1. 将配置文件复制到项目目录: cp config.template.sh /path/to/project/scripts/config.sh"
echo "2. 将 Provisioning Profile 复制到项目: cp *.provisionprofile /path/to/project/mas/"
echo "3. 将权限文件复制到项目: cp *.plist /path/to/project/mas/"
echo "4. 在项目目录运行: npm run setup:environment"
EOF
    
    chmod +x "$output_dir/import-certificates.sh"
    log_success "已创建导入脚本: import-certificates.sh"
}

# 创建说明文档
create_readme() {
    local output_dir="$1"
    
    cat > "$output_dir/README.md" << 'EOF'
# JLCONE 证书包

这个文件夹包含了在新 Mac 上配置 JLCONE 开发环境所需的所有文件。

## 📁 文件说明

- `developer-application.p12` - 应用签名证书
- `developer-installer.p12` - 安装包签名证书
- `macdistributionprofile.provisionprofile` - App Store 分发配置文件
- `entitlements.mas.plist` - 应用权限配置
- `entitlements.mas.inherit.plist` - 继承权限配置
- `entitlements.mas.loginhelper.plist` - 登录助手权限配置
- `config.template.sh` - 配置文件模板
- `import-certificates.sh` - 证书导入脚本

## 🚀 在新 Mac 上的使用步骤

### 1. 导入证书
```bash
./import-certificates.sh
```

### 2. 配置项目
```bash
# 复制配置文件到项目
cp config.template.sh /path/to/project/scripts/config.sh

# 复制 Provisioning Profile
cp *.provisionprofile /path/to/project/mas/

# 复制权限文件
cp *.plist /path/to/project/mas/
```

### 3. 验证环境
```bash
cd /path/to/project
npm run setup:environment
```

### 4. 测试构建
```bash
npm run quick-build
```

## 🔒 安全提醒

- 证书文件包含私钥，请妥善保管
- 不要将证书文件提交到版本控制系统
- 定期检查证书有效期
- 使用强密码保护证书文件

## 📞 支持

如果遇到问题，请参考项目中的 `证书迁移指南.md` 文档。
EOF
    
    log_success "已创建说明文档: README.md"
}

# 主函数
main() {
    echo
    log_info "=== JLCONE 证书导出脚本 ==="
    echo
    
    # 解析参数
    case "${1:-}" in
        -h|--help)
            show_help
            exit 0
            ;;
    esac
    
    # 设置输出目录
    OUTPUT_DIR="${1:-./certificates}"
    
    # 检查是否在项目根目录
    if [ ! -f "package.json" ]; then
        log_error "请在项目根目录运行此脚本"
        exit 1
    fi
    
    # 创建输出目录
    mkdir -p "$OUTPUT_DIR"
    log_info "输出目录: $OUTPUT_DIR"
    
    # 查找证书
    if ! find_certificates; then
        exit 1
    fi
    
    # 导出证书
    export_certificate "$APP_CERT_HASH" "Application" "$OUTPUT_DIR/developer-application.p12"
    export_certificate "$INSTALLER_CERT_HASH" "Installer" "$OUTPUT_DIR/developer-installer.p12"
    
    # 复制配置文件
    copy_config_files "$OUTPUT_DIR"
    
    # 创建导入脚本
    create_import_script "$OUTPUT_DIR"
    
    # 创建说明文档
    create_readme "$OUTPUT_DIR"
    
    echo
    log_success "=== 证书导出完成 ==="
    echo
    log_info "导出的文件:"
    ls -la "$OUTPUT_DIR"
    echo
    log_info "下一步操作:"
    echo "1. 将整个 '$OUTPUT_DIR' 文件夹传输到新 Mac"
    echo "2. 在新 Mac 上运行 '$OUTPUT_DIR/import-certificates.sh'"
    echo "3. 按照 README.md 中的说明配置项目"
    echo
}

# 运行主函数
main "$@"