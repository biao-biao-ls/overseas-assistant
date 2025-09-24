# App Store 发布脚本

这个目录包含了用于自动化 JLCONE 应用 App Store 发布流程的脚本。

## 脚本说明

### 1. `build-and-upload.sh` - 完整发布脚本

自动执行完整的 App Store 发布流程：
- 构建项目
- 打包 App Store 版本
- 验证签名
- 公证应用
- 上传到 App Store Connect

**使用方法：**
```bash
# 完整流程
npm run release:app-store

# 或直接运行脚本
./scripts/build-and-upload.sh

# 跳过构建步骤（如果已经构建过）
./scripts/build-and-upload.sh --skip-build

# 只构建不上传
./scripts/build-and-upload.sh --no-upload

# 跳过公证步骤
./scripts/build-and-upload.sh --skip-notarization

# 强制使用命令行工具上传
./scripts/build-and-upload.sh --use-altool

# 只清理构建文件
./scripts/build-and-upload.sh --clean-only

# 查看帮助
./scripts/build-and-upload.sh --help
```

### 2. `quick-build.sh` - 快速构建脚本

只执行构建和打包，不进行公证和上传。适用于快速测试构建流程。

**使用方法：**
```bash
npm run quick-build
# 或
./scripts/quick-build.sh
```

### 3. `config.sh` - 配置文件

包含 Apple Developer 账户信息和应用配置。

**配置项：**
- `APPLE_ID`: Apple ID 邮箱
- `APP_SPECIFIC_PASSWORD`: 应用专用密码
- `TEAM_ID`: 开发者团队 ID
- `BUNDLE_ID`: 应用 Bundle ID
- `APP_NAME`: 应用名称
- `SKIP_NOTARIZATION`: 是否跳过公证
- `AUTO_UPLOAD`: 是否自动上传
- `USE_ALTOOL`: 是否使用命令行工具上传

## 前置要求

### 1. 开发者证书
确保已安装以下证书：
- `3rd Party Mac Developer Application`
- `3rd Party Mac Developer Installer`

### 2. Provisioning Profile
确保 `mas/macdistributionprofile.provisionprofile` 文件包含正确的证书。

### 3. 应用专用密码
在 Apple ID 账户设置中生成应用专用密码，用于命令行工具认证。

### 4. 工具依赖
- Node.js 和 npm
- Xcode 命令行工具
- Transporter 应用（可选，用于图形界面上传）

## 常见问题

### Q: 公证失败怎么办？
A: 检查应用是否符合 App Store 要求，查看公证日志获取详细错误信息。可以使用 `--skip-notarization` 参数跳过公证步骤。

### Q: 上传失败怎么办？
A: 
1. 检查网络连接
2. 确认 Apple ID 和应用专用密码正确
3. 尝试使用 `--use-altool` 参数强制使用命令行工具

### Q: 证书问题怎么解决？
A: 
1. 确保证书未过期
2. 检查 Provisioning Profile 是否包含正确的证书
3. 重新下载并安装证书

## 文件结构

```
scripts/
├── build-and-upload.sh    # 主发布脚本
├── quick-build.sh         # 快速构建脚本
├── config.sh              # 配置文件
└── README.md              # 说明文档
```

## 安全提示

- 不要将包含敏感信息的 `config.sh` 文件提交到版本控制系统
- 定期更新应用专用密码
- 保护好开发者证书的私钥

## 支持

如果遇到问题，请检查：
1. 脚本输出的错误信息
2. Apple Developer 网站的证书状态
3. App Store Connect 的构建状态