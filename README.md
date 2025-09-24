# JLCONE - Electron 应用开发和发布工具

JLCONE 是一个完整的 Electron 应用开发和 App Store 发布解决方案，提供自动化的构建、签名、公证和上传功能。

## 🚀 快速开始

### 一键发布到 App Store
```bash
npm run release:app-store
```

### 快速构建测试
```bash
npm run quick-build
```

## 📚 完整文档

- **[📖 文档索引](文档索引.md)** - 所有文档的导航
- **[🚀 快速开始](快速开始.md)** - 基本使用方法
- **[📱 App Store发布指南](App Store发布指南.md)** - 详细发布流程
- **[🔄 快速迁移指南](快速迁移指南.md)** - 30分钟环境配置
- **[🔐 证书迁移指南](证书迁移指南.md)** - 详细迁移步骤

## ✨ 主要功能

- ✅ 一键构建和发布
- ✅ 自动证书签名
- ✅ 出口合规配置
- ✅ 版本号管理
- ✅ 环境迁移工具
- ✅ 完整的故障排除

## 🛠️ 环境要求

- macOS 10.15+
- Xcode 12+
- Node.js 16+
- Apple Developer 账户

## 📋 常用命令

### 发布相关
```bash
npm run release:app-store     # 完整发布流程
npm run quick-build          # 快速构建测试
npm run package:app-store    # 仅打包不上传
```

### 版本管理
```bash
npm run version:patch        # 增加补丁版本 (1.0.2 → 1.0.3)
npm run version:minor        # 增加次版本 (1.0.2 → 1.1.0)
npm run version:major        # 增加主版本 (1.0.2 → 2.0.0)
npm run version:current      # 查看当前版本
```

### 环境管理
```bash
npm run export:certificates  # 导出证书和配置
npm run setup:environment    # 检查环境配置
```

## 🔄 环境迁移

### 在原 Mac 上导出
```bash
npm run export:certificates
```

### 在新 Mac 上配置
```bash
# 1. 导入证书
./certificates/import-certificates.sh

# 2. 配置项目
cp certificates/config.template.sh scripts/config.sh
cp certificates/*.provisionprofile mas/
cp certificates/*.plist mas/

# 3. 验证环境
npm run setup:environment
```

## 📁 项目结构

```
├── mas/                     # App Store 配置
│   ├── entitlements.mas.plist
│   └── macdistributionprofile.provisionprofile
├── scripts/                 # 自动化脚本
│   ├── build-and-upload.sh
│   ├── version-manager.sh
│   └── export-certificates.sh
├── builder.js              # 构建配置
└── 文档/                   # 中文文档
    ├── 快速开始.md
    ├── 证书迁移指南.md
    └── ...
```

## 🆘 获取帮助

- 📖 查看 [文档索引](文档索引.md) 获取完整文档列表
- 🚀 阅读 [快速开始](快速开始.md) 了解基本用法
- 🔧 参考 [App Store发布指南](App Store发布指南.md) 解决发布问题
- 💬 查看各个脚本的 `--help` 选项获取详细帮助

## 📄 许可证

本项目采用 ISC 许可证。

## 👥 贡献者

- Jialichuang(Hong Kong) co., Limited
