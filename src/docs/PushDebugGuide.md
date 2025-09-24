# 消息推送调试工具使用指南

## 概述

本应用集成了完善的消息推送调试工具，可以在开发者工具的Console面板中实时查看推送日志和控制推送服务。

## 如何打开Console面板

### Windows/Linux
- 按 `F12` 键
- 或按 `Ctrl + Shift + I`
- 或右键点击页面 → 选择"检查"

### macOS
- 按 `Cmd + Option + I`
- 或右键点击页面 → 选择"检查元素"

## 可用的调试命令

### 1. 基础状态查看

```javascript
// 显示推送服务状态
pushDebug.showStatus()
// 或使用快捷方法
showPushStatus()

// 显示详细统计信息
pushDebug.showDetailedStats()
// 或使用快捷方法
showPushStats()
```

### 2. 服务控制

```javascript
// 重启推送服务
pushDebug.restartService()

// 清除所有通知
pushDebug.clearNotifications()
```

### 3. 调试和故障排除

```javascript
// 调试IPC通信状态
pushDebug.debugIPC()

// 显示所有可用命令
pushDebug.showHelp()
```

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + Shift + P` | 显示推送状态 |
| `Ctrl + Shift + D` | 显示详细统计 |
| `Ctrl + Shift + R` | 重启推送服务 |
| `Ctrl + Shift + H` | 显示帮助信息 |

## 日志输出格式

推送相关的日志会以特定的格式和图标显示在Console中：

### 日志级别图标

- 🔍 **调试信息** - 详细的调试日志
- ℹ️ **一般信息** - 普通的信息日志
- ⚠️ **警告信息** - 需要注意的警告
- ❌ **错误信息** - 错误和异常

### 连接状态图标

- 🟢 **已连接** - WebSocket连接正常
- 🟡 **连接中** - 正在建立连接
- 🟠 **重连中** - 正在尝试重连
- 🔴 **已断开** - 连接已断开
- ❌ **连接错误** - 连接出现错误

### 功能模块图标

- 🔗 **连接管理** - WebSocket连接相关
- 💓 **心跳保活** - 心跳消息相关
- 📨 **消息处理** - 消息接收和发送
- 🔄 **重连机制** - 自动重连相关
- 📊 **统计信息** - 各种统计数据

## 实时监控

### 启动监控

```javascript
// 开始实时监控推送服务状态
pushDebug.startMonitoring()
```

### 停止监控

```javascript
// 停止实时监控
pushDebug.stopMonitoring()
```

## 常见问题排查

### 1. 调试工具未加载

**现象**: Console中输入 `showPushStatus()` 显示 "ReferenceError: showPushStatus is not defined"

**解决方法**:
```javascript
// 1. 检查是否有推送调试工具
console.log('pushDebug:', typeof window.pushDebug)
console.log('showPushStatus:', typeof window.showPushStatus)

// 2. 如果没有，等待几秒后重试（工具可能还在加载）
setTimeout(() => {
    if (typeof showPushStatus === 'function') {
        showPushStatus()
    } else {
        console.error('推送调试工具未正确加载，请刷新页面重试')
    }
}, 3000)

// 3. 手动检查preload脚本是否正确加载
console.log('Preload scripts loaded:', !!window.electron)
```

### 2. 推送服务未启动

**现象**: Console显示"推送管理器未初始化"

**解决方法**:
```javascript
// 检查服务状态
pushDebug.showStatus()

// 如果服务未启动，尝试重启
pushDebug.restartService()
```

### 3. IPC通信超时

**现象**: 调试命令无响应，显示超时错误

**排查步骤**:
```javascript
// 1. 检查主进程是否正常运行
// 2. 查看是否有IPC通信错误
// 3. 尝试重启应用
```

### 4. 连接频繁断开

**现象**: 看到大量重连日志

**排查步骤**:
```javascript
// 1. 查看详细统计
pushDebug.showDetailedStats()

// 2. 检查网络连接
// 3. 查看错误日志中的具体错误信息
```

### 5. 消息接收异常

**现象**: 推送消息无法正常接收

**排查步骤**:
```javascript
// 1. 检查连接状态
pushDebug.showStatus()

// 2. 查看消息统计
pushDebug.showDetailedStats()

// 3. 重启推送服务
pushDebug.restartService()
```

## 高级调试技巧

### 1. 过滤特定日志

在Console的Filter框中输入关键词来过滤日志：

- `推送` - 显示所有推送相关日志
- `WebSocket` - 显示WebSocket连接日志
- `心跳` - 显示心跳相关日志
- `错误` - 只显示错误日志

### 2. 保存日志

```javascript
// 右键点击Console中的日志 → 选择"Save as..."
// 可以将日志保存为文本文件
```

### 3. 清空Console

```javascript
// 按 Ctrl+L 或在Console中输入
console.clear()
```

## 日志文件位置

除了Console输出，日志也会保存到文件中：

### Windows
```
%APPDATA%\JLCAssistant\logs\
├── info\file.log          # 一般信息日志
├── error\file.log         # 错误日志
├── push\*.log             # 推送专用日志
└── net.log                # 网络日志
```

### macOS
```
~/Library/Application Support/JLCAssistant/logs/
```

### Linux
```
~/.config/JLCAssistant/logs/
```

## 注意事项

1. **性能影响**: 详细日志可能会影响性能，建议在调试完成后关闭详细日志
2. **敏感信息**: 日志中可能包含Token等敏感信息，请注意保护
3. **日志大小**: 日志文件会自动轮转，避免占用过多磁盘空间
4. **开发环境**: 某些调试功能仅在开发环境中可用

## 快速验证脚本

如果不确定推送调试工具是否正常工作，可以在Console中运行以下验证脚本：

```javascript
// 推送调试工具验证脚本
(function() {
    console.log('🔍 [验证] 开始检查推送调试工具...')
    
    // 检查全局对象
    const checks = [
        { name: 'pushDebug', obj: window.pushDebug },
        { name: 'showPushStatus', obj: window.showPushStatus },
        { name: 'showPushStats', obj: window.showPushStats },
        { name: 'electron', obj: window.electron }
    ]
    
    let allPassed = true
    
    checks.forEach(check => {
        const exists = typeof check.obj !== 'undefined'
        const status = exists ? '✅' : '❌'
        console.log(`${status} ${check.name}: ${typeof check.obj}`)
        if (!exists) allPassed = false
    })
    
    if (allPassed) {
        console.log('🎉 [验证] 推送调试工具验证通过！')
        console.log('💡 [提示] 现在可以使用 showPushStatus() 查看推送状态')
    } else {
        console.log('⚠️ [验证] 推送调试工具验证失败')
        console.log('🔧 [建议] 请刷新页面或检查preload脚本是否正确加载')
    }
})()
```

## 测试页面

我们提供了一个专门的测试页面来验证推送调试功能：

**文件位置**: `src/test/pushDebugTest.html`

**使用方法**:
1. 在应用中打开该测试页面
2. 按F12打开开发者工具
3. 点击页面上的按钮测试各项功能
4. 查看Console中的输出结果

## 技术支持

如果遇到问题，请：

1. 运行上面的验证脚本检查工具状态
2. 使用 `pushDebug.showDetailedStats()` 收集详细信息
3. 保存相关的Console日志
4. 联系技术支持团队

---

**提示**: 这个调试工具是为开发者和技术支持人员设计的，普通用户通常不需要使用这些功能。