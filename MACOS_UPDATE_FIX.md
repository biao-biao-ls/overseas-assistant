# macOS 更新问题修复方案

## 问题描述
在 2019年 macOS Intel 芯片机器上，electron-updater 存在以下问题：
- 检查更新间隔很长
- 下载进度到 100% 后卡在"正在安装"状态
- 更新安装过程无响应

## 解决方案

### 1. 版本兼容性修复
- **降级 electron-updater**：从 `^5.3.0` 降级到 `^4.6.5`
- 旧版本对 2019年 macOS 系统兼容性更好

### 2. 智能配置系统
创建了 `MacOSCompatibility.simple` 工具类，根据 macOS 版本自动调整配置：

**注意**：为了避免启动问题，我们使用了简化版本的兼容性工具类，移除了可能在应用启动早期导致问题的复杂功能。

#### 旧版 macOS (10.15 及更早)
```typescript
{
    autoDownload: false,        // 禁用自动下载
    autoInstallOnAppQuit: true, // 退出时安装
    allowPrerelease: false,
    allowDowngrade: false
}
```

#### 非常旧版 macOS (10.14 及更早)
```typescript
{
    autoDownload: false,        // 禁用自动下载
    autoInstallOnAppQuit: true, // 退出时安装
    allowPrerelease: false,
    allowDowngrade: true        // 允许降级
}
```

### 3. 缓存清理机制
- 自动检测旧版 macOS 并清理多个缓存目录
- 包括 `updater`、`JLCONE-updater`、`Caches` 等目录
- 清理临时文件和系统缓存

### 4. 安装策略优化
- **旧版 macOS**：使用 `quitAndInstall(false, true)` 强制安装
- **增加超时时间**：旧版系统 10-15 秒，新版系统 5 秒
- **错误处理**：安装失败时直接退出应用

### 5. 详细日志记录
创建了 `UpdateLogger` 类：
- 记录系统信息和兼容性配置
- 跟踪更新事件和错误
- 支持导出日志文件用于调试

## 文件修改清单

### 新增文件
- `src/utils/MacOSCompatibility.simple.ts` - macOS 兼容性工具类（简化版）
- `src/utils/UpdateLogger.ts` - 更新日志记录器（暂时禁用）
- `scripts/test-update-compatibility.js` - 兼容性测试脚本
- `scripts/test-startup.js` - 应用启动测试脚本
- `scripts/verify-fix.js` - 修复验证脚本
- `MACOS_UPDATE_FIX.md` - 本文档

### 修改文件
- `src/main/main.ts` - 主进程更新逻辑（使用简化版本）
- `src/renderer/updateTip/updateTip.tsx` - 更新界面优化
- `package.json` - 依赖版本和脚本

### 临时禁用的功能
为了确保应用能正常启动，我们暂时禁用了以下功能：
- 复杂的缓存清理逻辑
- 详细的日志记录系统
- 在应用启动早期的文件系统操作

## 使用方法

### 1. 安装依赖
```bash
npm install
```

### 2. 测试兼容性
```bash
npm run test:update-compatibility
```

### 3. 构建应用
```bash
npm run build
npm run package:mac
```

### 4. 开发调试
```bash
npm run dev
```

## 测试验证

### 在不同 macOS 版本上测试
1. **macOS 10.14 及更早**：
   - 应该看到"非常旧的 macOS"配置
   - 禁用自动下载，手动触发
   - 15秒安装超时

2. **macOS 10.15**：
   - 应该看到"旧版 macOS"配置
   - 禁用自动下载，手动触发
   - 10秒安装超时

3. **macOS 11.0 及更新**：
   - 使用标准配置
   - 启用自动下载
   - 5秒安装超时

### 日志检查
查看控制台输出，应该看到：
```
🍎 macOS 兼容性信息: { version: {...}, isOldMacOS: true/false, ... }
🧹 清除 electron-updater 缓存
📦 发现可用更新，开始下载
🍎 旧版 macOS 使用兼容安装模式
```

## 预期效果

### 修复前
- 更新检查间隔长
- 安装过程卡住
- 无详细错误信息

### 修复后
- 根据系统版本自动优化配置
- 手动触发下载，避免卡住
- 强制安装模式，提高成功率
- 详细日志记录，便于调试
- 自动缓存清理，减少问题

## 故障排除

### 如果更新仍然失败
1. 运行兼容性测试：`npm run test:update-compatibility`
2. 检查控制台日志中的错误信息
3. 手动清理缓存目录
4. 确认网络连接和服务器可访问性
5. 检查应用权限设置

### 常见问题
- **权限问题**：确保应用有写入权限
- **网络问题**：检查防火墙和代理设置
- **缓存问题**：手动删除 `~/Library/Application Support/JLCONE` 下的缓存
- **版本问题**：确认服务器上有对应的更新文件

## 技术细节

### macOS 版本检测
```typescript
// Darwin 版本到 macOS 版本的映射
// Darwin 19.x = macOS 10.15 (Catalina)
// Darwin 20.x = macOS 11.x (Big Sur)
// Darwin 21.x = macOS 12.x (Monterey)
```

### 安装策略
```typescript
// 旧版 macOS 使用强制安装
autoUpdater.quitAndInstall(false, true)

// 新版 macOS 使用标准安装
autoUpdater.quitAndInstall()
```

这个修复方案应该能够解决 2019年 macOS Intel 机器上的更新问题，同时保持对新版 macOS 的兼容性。